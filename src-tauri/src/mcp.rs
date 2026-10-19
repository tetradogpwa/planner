// ────────────────────────────────────────────────────────────────────
// mcp.rs — Servidor MCP local (Model Context Protocol) del Planificador.
//
// Solo se compila en escritorio (Linux, Windows, macOS). En
// Android/iOS este módulo ni se incluye.
//
// ## Arquitectura
//
// Los datos (tareas, fecha de inicio) viven en `localStorage` del
// webview, no en Rust. El servidor MCP no los lee directamente: cuando
// llega una llamada a una herramienta (tool call), el servidor la
// reenvía al frontend como evento Tauri y se queda esperando (oneshot)
// a que el frontend responda con `mcp_reply`.
//
//   cliente MCP --(HTTP)-->  mcp_start(port, token)  -->  Tauri evento
//                                                          'mcp:call'
//                                                       --> webview
//                                                          (PlannerApi)
//                                                       -->  invoke
//                                                          'mcp_reply'
//                                                       --> oneshot
//                                                          resuelve
//   cliente MCP <--(JSON-RPC)--  HTTP response
//
// El servidor escucha solo en 127.0.0.1, exige un token Bearer en
// `Authorization`, y rechaza todo lo demás con 401.
// ────────────────────────────────────────────────────────────────────

use axum::middleware::{self, Next};
use axum::response::Response;
use axum::{extract::Request, http::StatusCode, Router};
use rmcp::handler::server::tool::{Parameters, ToolRouter};
use rmcp::model::*;
use rmcp::schemars;
use rmcp::tool;
use rmcp::tool_handler;
use rmcp::tool_router;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::ErrorData as McpError;
use rmcp::ServerHandler;
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::AppHandle;
use tauri::Wry;
use tauri::{Emitter, Manager};
use tokio::sync::oneshot;

// ── Estado compartido del servidor ───────────────────────────────────

/// Mapa de respuestas pendientes: id de la llamada al canal que el
/// frontend usa para responder.
type ReplyMap = Arc<Mutex<std::collections::HashMap<String, oneshot::Sender<McpReply>>>>;

/// Token actual del servidor. `Arc<Mutex<Option<String>>>` para que el
/// middleware de autenticación pueda leer SIEMPRE el token vivo (si se
/// regenera con el servidor en pie, el siguiente request ya ve el
/// nuevo y el viejo deja de funcionar, sin tener que rearrancar).
type TokenSlot = Arc<Mutex<Option<String>>>;

/// Estado global del MCP. Vive como `tauri::State` mientras la app
/// esté abierta.
pub struct McpState {
    /// Token Bearer actual (32 bytes hex = 64 chars). `None` si el
    /// servidor no está activo.
    pub token: TokenSlot,
    /// JoinHandle del task que escucha en el puerto (para pararlo).
    pub task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    /// Puerto en el que se escucha (para devolverlo a la UI).
    pub port: Mutex<Option<u16>>,
    /// Mapa de respuestas pendientes: el id de la llamada al canal
    /// que el frontend usa para responder.
    pub pending: ReplyMap,
}

impl Default for McpState {
    fn default() -> Self {
        Self {
            token: Arc::new(Mutex::new(None)),
            task: Mutex::new(None),
            port: Mutex::new(None),
            pending: Arc::new(Mutex::new(std::collections::HashMap::new())),
        }
    }
}

/// Mensaje que el frontend envía de vuelta con el resultado de una
/// herramienta. Lo definimos como JSON plano para que el webview
/// pueda construirlo con un `JSON.stringify`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpReply {
    pub id: String,
    pub ok: bool,
    /// Resultado o mensaje de error, según `ok`. Se devuelve tal cual
    /// al cliente MCP dentro de `CallToolResult`.
    pub payload: serde_json::Value,
}

/// Estado público del servidor MCP para el frontend.
#[derive(Debug, Clone, Serialize)]
pub struct McpStatus {
    pub active: bool,
    pub port: Option<u16>,
}

// ── Argumentos de las herramientas ──────────────────────────────────

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct VerTareaArgs {
    #[schemars(description = "Índice de la tarea (0..N-1)")]
    pub index: i64,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CrearTareaArgs {
    #[schemars(description = "Spec JSON plano de la tarea (ver descripción de crear_tarea).")]
    pub spec: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct EditarTareaArgs {
    #[schemars(description = "Índice de la tarea a sustituir")]
    pub index: i64,
    #[schemars(description = "Spec JSON plano de la nueva tarea")]
    pub spec: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct BorrarTareaArgs {
    #[schemars(description = "Índice de la tarea a eliminar")]
    pub index: i64,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct VerSemanaArgs {
    #[schemars(description = "Semana desde la fecha de inicio (0 = actual, 1 = la siguiente, -1 = la anterior)")]
    pub offset: i64,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CambiarFechaArgs {
    #[schemars(description = "Fecha ISO 'YYYY-MM-DD'")]
    pub iso_date: String,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AbrirVistaArgs {
    #[schemars(description = "Nombre de la vista: tasks, week, allWeeks, data, print, legal, settings o accessibility")]
    pub view: String,
}

// ── ServerHandler: herramientas que se exponen al cliente MCP ─────────

#[derive(Clone)]
pub struct PlannerServer {
    tool_router: ToolRouter<Self>,
    /// AppHandle de Tauri para emitir el evento 'mcp:call' al webview.
    /// Usamos `AppHandle` (Wry) que es el runtime real en escritorio.
    app: AppHandle,
    /// Mapa de respuestas pendientes.
    pending: ReplyMap,
}

impl PlannerServer {
    fn new(app: AppHandle, pending: ReplyMap) -> Self {
        Self {
            tool_router: Self::tool_router(),
            app,
            pending,
        }
    }
}

#[tool_router]
impl PlannerServer {
    /// `listar_tareas` — devuelve la lista de tareas como JSON.
    #[tool(
        description = "Lista todas las tareas del planificador con su tipo, nombre, total y, si aplica, los días o el ciclo. Equivalente a PlannerApi.listTasks().",
        annotations(read_only_hint = true)
    )]
    async fn listar_tareas(&self) -> Result<CallToolResult, McpError> {
        self.call_frontend("listar_tareas", serde_json::json!({})).await
    }

    /// `ver_tarea` — devuelve una tarea por índice.
    #[tool(
        description = "Devuelve la tarea en el índice dado (0..N-1) como JSON plano. Si el índice no existe devuelve null.",
        annotations(read_only_hint = true)
    )]
    async fn ver_tarea(
        &self,
        Parameters(VerTareaArgs { index }): Parameters<VerTareaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("ver_tarea", serde_json::json!({ "index": index })).await
    }

    /// `crear_tarea` — crea una tarea a partir de un spec JSON plano.
    #[tool(description = "Crea una tarea nueva a partir de un spec JSON plano validado. Campos: name (str, obligatorio), repeat ('none' | 'daily' | 'nDays' | 'daysOfWeek' | 'cycle'), total (int >= 1, opcional, default 1), daysFrom (int >= 0, opcional, default 0). Para 'nDays' añadir nDays (int >= 2). Para 'daysOfWeek' añadir days ([0..6]). Para 'cycle' añadir cycle ([[0..6], ...], puede incluir semanas de descanso vacías). Devuelve la tarea creada como JSON.")]
    async fn crear_tarea(
        &self,
        Parameters(args): Parameters<CrearTareaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("crear_tarea", args.spec).await
    }

    /// `editar_tarea` — sustituye la tarea en `index` por un spec nuevo.
    #[tool(description = "Sustituye la tarea en el índice dado por un spec JSON plano. Mismos campos que crear_tarea. Devuelve la nueva tarea como JSON.")]
    async fn editar_tarea(
        &self,
        Parameters(args): Parameters<EditarTareaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("editar_tarea", serde_json::json!({
            "index": args.index,
            "spec":  args.spec,
        })).await
    }

    /// `borrar_tarea` — elimina la tarea en `index`.
    #[tool(
        description = "Elimina la tarea en el índice dado. Devuelve el nombre de la tarea borrada como JSON.",
        annotations(destructive_hint = true)
    )]
    async fn borrar_tarea(
        &self,
        Parameters(args): Parameters<BorrarTareaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("borrar_tarea", serde_json::json!({ "index": args.index })).await
    }

    /// `ver_semana` — devuelve los 7 días de la semana `offset`.
    #[tool(
        description = "Devuelve los 7 días de la semana `offset` desde la fecha de inicio (0 = actual, 1 = la siguiente, -1 = la anterior). Cada día incluye la fecha ISO local, el nombre del día (Lun, Mar, ...) y la lista de tareas que tocan ese día.",
        annotations(read_only_hint = true)
    )]
    async fn ver_semana(
        &self,
        Parameters(args): Parameters<VerSemanaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("ver_semana", serde_json::json!({ "offset": args.offset })).await
    }

    /// `cambiar_fecha_inicio` — fija la fecha de inicio.
    #[tool(description = "Cambia la fecha de inicio del planificador. Acepta una cadena ISO 'YYYY-MM-DD'. Devuelve la fecha aceptada como JSON.")]
    async fn cambiar_fecha_inicio(
        &self,
        Parameters(args): Parameters<CambiarFechaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("cambiar_fecha_inicio", serde_json::json!({ "isoDate": args.iso_date })).await
    }

    /// `abrir_vista` — pide al frontend que cambie la vista activa.
    #[tool(description = "Cambia la vista activa del planificador. `view` debe ser uno de: 'tasks', 'week', 'allWeeks', 'data', 'print', 'legal', 'settings', 'accessibility'.")]
    async fn abrir_vista(
        &self,
        Parameters(args): Parameters<AbrirVistaArgs>,
    ) -> Result<CallToolResult, McpError> {
        self.call_frontend("abrir_vista", serde_json::json!({ "view": args.view })).await
    }

    /// `exportar_json` — devuelve el JSON exportable de todas las tareas.
    #[tool(
        description = "Devuelve un string JSON con todas las tareas (mismo formato que 'Importar JSON' en Gestión de datos).",
        annotations(read_only_hint = true)
    )]
    async fn exportar_json(&self) -> Result<CallToolResult, McpError> {
        self.call_frontend("exportar_json", serde_json::json!({})).await
    }
}

#[tool_handler]
impl ServerHandler for PlannerServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}

// ── Implementación: reenviar la llamada al frontend y esperar la respuesta

impl PlannerServer {
    /// Emite un evento 'mcp:call' al webview con `tool` y `args`, y
    /// espera (timeout 10s) a que el frontend conteste con `mcp_reply`.
    /// Si el frontend no responde a tiempo, devuelve un error MCP claro.
    async fn call_frontend(
        &self,
        tool: &str,
        args: serde_json::Value,
    ) -> Result<CallToolResult, McpError> {
        // Generamos un id único por llamada para emparejar la respuesta.
        let id = format!("{}-{}", tool, std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0));

        // Canal oneshot: el frontend lo resolverá con `mcp_reply`.
        let (tx, rx) = oneshot::channel::<McpReply>();
        self.pending.lock().unwrap().insert(id.clone(), tx);

        // Emitimos el evento al webview. Si no hay ventana principal
        // (p.ej. el usuario la cerró), devolvemos un error claro.
        let payload = serde_json::json!({ "id": id, "tool": tool, "args": args });
        if let Err(err) = self.app.emit("mcp:call", payload) {
            self.pending.lock().unwrap().remove(&id);
            return Err(McpError::internal_error(
                format!("No se pudo enviar la llamada al frontend: {err}"),
                None,
            ));
        }

        // Esperamos hasta 10 segundos. Pasado ese tiempo devolvemos
        // un error en vez de colgarnos.
        let reply = match tokio::time::timeout(std::time::Duration::from_secs(10), rx).await {
            Ok(Ok(reply)) => reply,
            Ok(Err(_canceled)) => {
                return Err(McpError::internal_error(
                    "El frontend cerró el canal de respuesta".to_string(),
                    None,
                ));
            }
            Err(_elapsed) => {
                self.pending.lock().unwrap().remove(&id);
                return Err(McpError::internal_error(
                    "El frontend no respondió en 10 s. ¿Ha aceptado términos y consentimiento?",
                    None,
                ));
            }
        };

        // Convertimos la respuesta del frontend en `CallToolResult`.
        if reply.ok {
            // El frontend devuelve un `serde_json::Value` con el
            // resultado: lo serializamos como texto.
            let text = serde_json::to_string(&reply.payload)
                .unwrap_or_else(|_| "null".to_string());
            Ok(CallToolResult::success(vec![Content::text(text)]))
        } else {
            let msg = reply.payload.get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Error desconocido del frontend")
                .to_string();
            Err(McpError::internal_error(msg, None))
        }
    }
}

// ── Middleware: comprobar el token Bearer ────────────────────────────

/// Compara el token del header `Authorization: Bearer XXX` con el
/// guardado en el estado global. Si no coincide, devuelve 401.
///
/// El token se lee SIEMPRE del mismo `Arc<Mutex<>>` que
/// `McpState::token`, de modo que regenerarlo deja el viejo inservible
/// sin tener que rearrancar el servidor.
async fn auth_middleware(
    axum::extract::State(state): axum::extract::State<McpHandle>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let header = req.headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let provided = header.strip_prefix("Bearer ").unwrap_or("");
    let expected = state.token.lock().unwrap().clone().unwrap_or_default();
    // Comparación en tiempo constante para evitar timing attacks.
    let matches = !expected.is_empty()
        && provided.len() == expected.len()
        && provided.bytes()
            .zip(expected.bytes())
            .fold(0u8, |acc, (a, b)| acc | (a ^ b))
            == 0;
    if !matches {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(next.run(req).await)
}

/// Handle que se clona para cada request: contiene el MISMO `Arc` del
/// token que `McpState`, para que las regeneraciones se vean al
/// instante en el middleware.
#[derive(Clone)]
struct McpHandle {
    token: TokenSlot,
}

// ── Arranque y parada del servidor ──────────────────────────────────

/// Arranca el servidor HTTP en `127.0.0.1:port` con el token dado.
///
/// Si ya está activo, para la tarea anterior antes de rearrancar
/// (necesario cuando cambia el puerto). Si el puerto está ocupado,
/// devuelve `Err` SIN tocar el estado y deja `token` y `port` en
/// `None` para que la UI muestre el error y pueda intentarlo de nuevo.
pub async fn start(
    app: &AppHandle<Wry>,
    port: u16,
    token: String,
) -> Result<(), String> {
    let state = app.state::<McpState>();

    // Si ya había un servidor corriendo, lo paramos y limpiamos el
    // estado. Da igual que el puerto cambie o no: queremos volver a
    // enlazar para que la UI nunca diga "activo" en un puerto que no
    // está realmente escuchando.
    if state.token.lock().unwrap().is_some() {
        if let Some(handle) = state.task.lock().unwrap().take() {
            handle.abort();
        }
        *state.token.lock().unwrap() = None;
        *state.port.lock().unwrap() = None;
        state.pending.lock().unwrap().clear();
        // Damos un instante al task anterior para soltar el socket.
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }

    // Probamos a escuchar ANTES de mover el estado a "activo": así, si
    // el puerto está ocupado, devolvemos error y la UI puede mostrarlo
    // en lugar de fingir que todo va bien.
    //
    // Usamos `TcpSocket` (no `TcpListener::bind` directo) para fijar
    // `SO_REUSEADDR`: sin esto, al desactivar y volver a activar el
    // servidor, el puerto puede quedarse en TIME_WAIT durante decenas
    // de segundos y el re-bind falla con EADDRINUSE aunque sea el
    // mismo proceso. Esto es estrictamente local (127.0.0.1) y solo lo
    // usa esta app, así que `SO_REUSEADDR` no abre ninguna superficie
    // de ataque.
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = match tokio::net::TcpSocket::new_v4() {
        Ok(socket) => {
            if let Err(e) = socket.set_reuseaddr(true) {
                return Err(format!(
                    "No se pudo configurar SO_REUSEADDR en el puerto {port}: {e}"
                ));
            }
            match socket.bind(addr) {
                Ok(_) => match socket.listen(128) {
                    Ok(l) => Ok(l),
                    Err(e) => Err(format!(
                        "No se pudo escuchar en el puerto {port}: {e}"
                    )),
                },
                Err(e) => Err(format!(
                    "El puerto {port} está ocupado o no se puede abrir: {e}"
                )),
            }
        }
        Err(e) => Err(format!("No se pudo crear el socket del puerto {port}: {e}")),
    };
    let listener = match listener {
        Ok(l) => l,
        Err(msg) => {
            // Limpiamos lo que pudiéramos haber movido al rearrancar.
            *state.token.lock().unwrap() = None;
            *state.port.lock().unwrap() = None;
            return Err(msg);
        }
    };

    // A partir de aquí el servidor está en marcha. Movemos estado.
    *state.token.lock().unwrap() = Some(token.clone());
    *state.port.lock().unwrap() = Some(port);

    let pending = state.pending.clone();
    let app_for_task = app.clone();
    let token_for_task = state.token.clone();

    let handle = tokio::spawn(async move {
        let svc = StreamableHttpService::new(
            move || {
                let pending = pending.clone();
                Ok(PlannerServer::new(app_for_task.clone(), pending))
            },
            LocalSessionManager::default().into(),
            StreamableHttpServerConfig::default(),
        );

        let mcp_handle = McpHandle {
            token: token_for_task,
        };

        let router: Router = Router::new()
            .nest_service("/mcp", svc)
            .layer(middleware::from_fn_with_state(
                mcp_handle.clone(),
                auth_middleware,
            ));

        eprintln!("[mcp] servidor escuchando en http://{addr}/mcp");
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[mcp] servidor terminado: {e}");
        }
    });

    *state.task.lock().unwrap() = Some(handle);
    Ok(())
}

/// Detiene el servidor. Limpia token, puerto y la tarea en background.
pub fn stop(app: &AppHandle<Wry>) {
    let state = app.state::<McpState>();
    *state.token.lock().unwrap() = None;
    *state.port.lock().unwrap() = None;
    if let Some(handle) = state.task.lock().unwrap().take() {
        handle.abort();
    }
    // Las respuestas pendientes se cancelan al soltar el oneshot.
    state.pending.lock().unwrap().clear();
}

/// Devuelve el estado actual: (activo, puerto) si lo está.
pub fn status(app: &AppHandle<Wry>) -> (bool, Option<u16>) {
    let state = app.state::<McpState>();
    let active = state.token.lock().unwrap().is_some();
    let port   = *state.port.lock().unwrap();
    (active, port)
}

// ── Reply: comando Tauri que el frontend usa para responder ──────────

/// Recibe la respuesta de una herramienta MCP. El frontend la
/// invoca como `invoke('mcp_reply', { id, ok, payload })`. Si el
/// id no está en el mapa, simplemente se ignora.
#[tauri::command]
pub fn mcp_reply(
    app: AppHandle,
    id: String,
    ok: bool,
    payload: serde_json::Value,
) -> Result<(), String> {
    let state = app.state::<McpState>();
    let tx = state.pending.lock().unwrap().remove(&id);
    match tx {
        Some(tx) => {
            // Si el frontend no escucha ya, `send` falla, pero no
            // es grave: el servidor habrá devuelto un timeout.
            let _ = tx.send(McpReply { id, ok, payload });
            Ok(())
        }
        None => Err(format!("id de respuesta MCP desconocido: {id}")),
    }
}