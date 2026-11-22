# Planificador Semanal — versión Tauri

Planificador semanal con tareas recurrentes, ciclos personalizados y
exportación a PDF. **Funciona 100 % local; sin servidor ni cuentas.**

Esta es la versión **Tauri 2** del proyecto original (que era una PWA).
Permite distribuir la app como:

| Plataforma | Formato | Tienda / distribución |
|------------|---------|-----------------------|
| Linux | `.AppImage`, `.deb` | Web del Desarrollador (sin tienda central) |
| Windows | `.exe` (NSIS) | Web del Desarrollador + (opcional) Microsoft Store (como `.exe` firmado) |
| Android | `.apk`, `.aab` | Google Play Store (AAB) o sideload (APK) |

El código fuente del frontend es el mismo que la PWA original. La
capa nativa es Rust y solo aporta:

- ventana nativa con WebView (WebKitGTK / WebView2 / WebView de Android)
- comandos seguros `tauri::command` para abrir URLs, leer
  configuración nativa, etc.

---

## 📁 Estructura del repo

```
planner/
├── index.html            ← UI principal (entrada de Tauri)
├── index.js              ← bootstrap
├── context.js            ← estado global (LocalStorage)
├── index.css             ← estilos
├── ui/                   ← vistas (gestión tareas, semana, etc.)
├── back/                 ← lógica de cálculo de tareas
├── vendor/               ← librerías de terceros empaquetadas
│   └── html2pdf.bundle.min.js
├── monetization.js       ← capa de monetización (anuncios)
├── legal/                ← textos legales
├── src-tauri/            ← capa nativa Rust
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── csp.json         ← las dos variantes de la CSP (con/sin anuncios)
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs       ← entry point del binario
│   │   └── lib.rs        ← comandos + builder de Tauri
│   ├── icons/            ← iconos generados para cada plataforma
│   └── capabilities/
│       └── default.json  ← permisos del WebView
└── tools/                ← scripts de build y de pruebas
    ├── build.sh          ← script ÚNICO de build (linux/windows/android)
    ├── test.sh           ← pruebas unitarias y E2E
    ├── tasks/            ← cola de tareas del supervisor
    └── minimax/          ← lanzador del desarrollador (MiniMax)
```

### Build unificado (`tools/build.sh`)

Script único en bash que cubre los tres objetivos desde cualquier
carpeta (hace `cd` a la raíz del repo). Es el **único** script de build
del proyecto: los que había por plataforma (uno para Linux, otro para
Windows, otro para el paquete de la Store y otro para Android) se
eliminaron porque se contradecían entre sí y con `tauri.conf.json`.

```bash
./tools/build.sh                 # AppImage + .deb de Linux (release)
./tools/build.sh linux           # igual que sin argumentos
./tools/build.sh windows         # instalador NSIS .exe (compilación cruzada)
./tools/build.sh android         # APK de Android
./tools/build.sh android --aab   # AAB de Android (Google Play)
./tools/build.sh all             # Linux + Windows + Android
./tools/build.sh all --debug     # los tres en debug
./tools/build.sh --help          # muestra el uso completo
```

Antes de compilar cada objetivo, el script comprueba sus requisitos y,
si falta alguno, imprime exactamente qué instalar y cómo. Con `all`,
si un objetivo falla (requisitos o compilación) el script continúa con
los demás y al final muestra un resumen por objetivo (`✓` / `✗` con
motivo); el código de salida es `≠0` si alguno falla.

Al terminar, los artefactos generados (`*.AppImage`, `*.deb`, `*.apk`,
`*.aab`, `*-setup.exe`) se copian a `releases/` en la raíz del repo y se
listan con su tamaño. La carpeta `releases/` está en `.gitignore`.

Lo que lanza cada objetivo:

| Objetivo | Comando | Salida |
|----------|---------|--------|
| `linux` | `cargo tauri build --bundles appimage,deb` | `*.AppImage` y `*.deb` |
| `windows` | `cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis` | `*-setup.exe` |
| `android` | `cargo tauri android build --apk` | `*.apk` |
| `android --aab` | `cargo tauri android build --aab` | `*.aab` |

Los mismos bundles están declarados en `src-tauri/tauri.conf.json`
(`bundle.targets`), así que el script y la configuración no se
contradicen.

Requisitos generales (comunes a los tres objetivos):

- Rust toolchain estable (`rustup.rs`) y `cargo-tauri`:
  ```bash
  cargo install tauri-cli --version "^2.0" --locked
  ```

Requisitos específicos del **AppImage y el `.deb` de Linux**:

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libssl-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev build-essential curl wget file \
  pkg-config
```

Requisitos específicos del **instalador NSIS de Windows desde Linux
(compilación cruzada con `cargo-xwin`)** — el script detecta y reporta
cada uno si falta:

```bash
cargo install --locked cargo-xwin
rustup target add x86_64-pc-windows-msvc
sudo apt install -y nsis lld llvm clang   # lld-link + llvm-rc
```

Requisitos específicos del **APK/AAB de Android** — el script detecta y
reporta cada uno si falta:

- SDK de Android (API 24+) y NDK r25+:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/<version>
  ```
- Java 17 (Temurin o el de Android Studio).
- Inicialización del módulo Android (solo la primera vez):
  ```bash
  cargo tauri android init
  ```

Si existe `.env` en la raíz, el script lo carga automáticamente (con
`set -a; source .env; set +a`) para que `build.rs` y la firma de
Android reciban las variables sin imprimir sus valores.

### La versión de la app

La versión se define en **un solo sitio**: `src-tauri/Cargo.toml` (el
campo `version` del paquete).

`src-tauri/tauri.conf.json` la repite, y hace falta: Tauri usa ese
campo para el `versionName` del paquete de Android y para los recursos
de versión del `.exe` de Windows (`FileVersion`/`ProductVersion`). Si se
quitara, el paquete de Android se publicaría como "1.0" (el valor por
defecto de Gradle) y el `.exe` iría sin información de versión. El
resto (la versión que ve la app en runtime y la que ponen los nombres
de los artefactos) sí sale de `Cargo.toml`.

La copia no se desincroniza sola: la prueba
`tests/unit/build-scripts.test.mjs` falla si `Cargo.toml` y
`tauri.conf.json` no coinciden, y también si la versión aparece
copiada en cualquier otro sitio (otro `tauri.conf*.json`, el
`package.json`, un script de build o este README). Para cambiar la
versión: edita `Cargo.toml` y copia el valor a `tauri.conf.json`; la
prueba te avisa si se te olvida.

---

## 🚀 Build por plataforma

### Requisitos comunes

- **Rust ≥ 1.77** (`rustup.rs`).
- **Node.js 22.x** (opcional; solo si quieres servir el frontend
  en modo dev con HMR).

### Linux (AppImage + .deb)

```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev libssl-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  build-essential curl wget file pkg-config

./tools/build.sh linux
# → src-tauri/target/release/bundle/Planificador Semanal_*.AppImage
# → src-tauri/target/release/bundle/deb/planner_*.deb
# → los dos, copiados a releases/
```

### Windows (instalador NSIS .exe)

```bash
./tools/build.sh windows
# → src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe
# → copiado a releases/
```

En Windows, con Visual Studio 2022 (Build Tools con el workload
"Desktop development with C++"), se puede compilar también sin
compilación cruzada:

```bash
cargo tauri build --bundles nsis
```

#### Cómo se firma el instalador de Windows

El instalador se firma con **Authenticode** (`signtool`), y la firma
solo se puede aplicar en un **host Windows**, donde está `signtool` y
el almacén de certificados.

En `src-tauri/tauri.conf.json`:

```json
"windows": {
  "certificateThumbprint": "[TU_THUMBPRINT_CERTIFICADO_NSIS]",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```

`[TU_THUMBPRINT_CERTIFICADO_NSIS]` es un **placeholder**: es la casilla
donde va el thumbprint SHA-1 de tu certificado. Mientras siga ahí:

- **Compilando en Linux** (compilación cruzada con `cargo-xwin`): el
  instalador sale **sin firmar**. Tauri omite la firma porque `signtool`
  no existe fuera de Windows. Windows lo instalará avisando de que el
  editor es desconocido.
- **Compilando en Windows**: `signtool` busca en el almacén de
  certificados un certificado con ese thumbprint; como el placeholder no
  corresponde a ninguno, la firma falla y el build se para.

Para firmar de verdad:

1. Consigue un **certificado de firma de código** emitido por una CA
   reconocida por Windows. Para Microsoft Store, el certificado debe
   estar a nombre de la cuenta del publicador: el `Publisher` del
   paquete tiene que coincidir con el `PublisherDisplayName` de Partner
   Center.
2. Instálalo en el almacén de certificados de Windows:
   ```powershell
   PS> Import-PfxCertificate -FilePath .\cert.pfx -CertStoreLocation Cert:\CurrentUser\My
   ```
3. Copia su thumbprint SHA-1:
   ```powershell
   PS> Get-ChildItem Cert:\CurrentUser\My | Select-Object Subject, Thumbprint
   ```
4. Sustituye el placeholder de `certificateThumbprint` por ese
   thumbprint y compila **en Windows**. Tauri firmará el instalador
   (`signtool sign /fd sha256 /sha1 <thumbprint> /t <timestampUrl>`) con
   los valores de `digestAlgorithm` y `timestampUrl` de la configuración.

Si lo que quieres es un instalador **sin firmar**, quita el campo
`certificateThumbprint` de la configuración: Tauri avisa de que se salta
la firma y sigue.

### Microsoft Store (el `.exe` firmado, no un MSIX)

**Tauri 2 no genera MSIX.** Lo que produce son instaladores `.exe`
(NSIS) y `.msi` (WiX). El camino que hoy funciona para Microsoft Store
es subir el **`.exe` NSIS firmado** al Partner Center como producto de
tipo "EXE or MSI app":

1. Regístrate como desarrollador en Microsoft y crea el producto en
   [Partner Center](https://partner.microsoft.com/) → "New Product" →
   **"EXE or MSI app"**.
2. Compila el instalador **en Windows y con el certificado** (ver
   arriba): la Store exige firma.
3. El instalador tiene que ser **offline** (que no descargue WebView2 al
   instalar). Se puede con una configuración aparte:
   ```json
   // src-tauri/tauri.microsoftstore.conf.json
   { "bundle": { "windows": { "webviewInstallMode": { "type": "offlineInstaller" } } } }
   ```
   ```bash
   cargo tauri build --config src-tauri/tauri.microsoftstore.conf.json
   ```
4. Declara el **parámetro de instalación silenciosa**: `/S` (NSIS, con
   `S` mayúscula). Sin esto, la Store rechaza el envío ("Win32
   products must install silently").
5. Sube el `.exe` al Partner Center y rellena el listado (política de
   privacidad, capturas, clasificación…).

Sobre el **MSIX** propiamente dicho: existe el crate `cargo-msix`
(`cargo install cargo-msix --locked`), pero su propio README dice que
es "work in progress" y que "nothing is functional": hoy no hay forma
de generar un `.msix` con este proyecto. Si algún día se hace, el
paquete se firma con `signtool` y un certificado de CA reconocida por
Microsoft, y el `Publisher` del manifiesto tiene que coincidir con el
`PublisherDisplayName` de Partner Center. El script de MSIX que había
en el repo estaba sin implementar y además escribía dentro de `dist/`,
que es el `frontendDist` de Tauri (se borra en el siguiente build y se
embebe dentro del binario): se eliminó.

### Android (APK / AAB)

Requisitos: Android Studio (SDK + NDK), Java 17, keystore.

```bash
# Solo la primera vez
cargo tauri android init

# Build APK release (sideload)
./tools/build.sh android

# Build AAB (Google Play)
./tools/build.sh android --aab
```

`--aab` llama a `cargo tauri android build --aab` (el flag real de la
CLI de Tauri), así que genera un **Android App Bundle** de verdad, no un
APK renombrado. Gradle deja el APK en
`src-tauri/gen/android/app/build/outputs/apk/<variante>/` y el AAB en
`src-tauri/gen/android/app/build/outputs/bundle/<variante>/`; el script
copia el que encuentre a `releases/`. Si Gradle cambia de sitio la
salida, el script lo avisa y hay que mirar el directorio de salidas de
Gradle (`src-tauri/gen/android/app/build/outputs/`).

---

## 💰 Monetización

Por defecto la app **NO muestra anuncios**. Para activarlos, rellena
las variables en `.env` (ver `.env.example`):

```env
GOOGLE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
GOOGLE_ADSENSE_SLOT=YYYYYYYYYY
GOOGLE_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
```

- `GOOGLE_ADSENSE_CLIENT` → habilita anuncios en Linux/Windows WebView.
- `GOOGLE_ADMOB_APP_ID`    → habilita anuncios en Android.

**Sin claves, el build FALLA** (`src-tauri/build.rs`): no se publica una
app sin monetizar ni sin aviso, y en Android no se lleva el App ID de
prueba de Google. Si de verdad quieres una build sin anuncios (la versión
de pago, las pruebas o una build interna), pon `ALLOW_NO_ADS=1`:

```bash
ALLOW_NO_ADS=1 cargo tauri build
```

Los valores de las claves **no se imprimen** en el log de compilación
(solo su nombre): van incrustados en el binario desde un fichero
generado por `build.rs`.

El flujo de "quitar anuncios" es un **producto in-app**:

| Tienda | Cómo se implementa |
|--------|--------------------|
| Google Play | `tauri-plugin-billing` + `GooglePlayBilling` |
| Microsoft Store | `Microsoft Store IAP` API nativa (vía plugin) |
| Web (futuro) | `tauri-plugin-purchase` o TPV propio |

> **Por ahora la compra está solo documentada**. Cuando se vaya a
> activar, añadir el plugin correspondiente y un endpoint
> `verify_purchase` en el backend de Tauri para confirmar el
> justificante firmado por la tienda. La capa `monetization.js` ya
> tiene `markAdsRemoved()` lista para llamarse desde la UI al
> completarse la compra.

---

## 🔐 Privacidad y cumplimiento legal

Esta app, por diseño, **no recoge datos personales del usuario**.
Cuando la monetización está activa, Google Ads/AdMob trata datos
según su propia política.

Los textos legales están en `legal/`:

| Archivo | Finalidad |
|---------|-----------|
| `PRIVACY.md` | Política de privacidad (RGPD + CCPA/CPRA + LGPD) |
| `TERMS.md` | Términos de uso |
| `EULA.md` | EULA |
| `COOKIES.md` | Política de cookies (sin redes publicitarias) |
| `ACCESSIBILITY.md` | Declaración de accesibilidad WCAG 2.1 AA |
| `ACCEPTABLE_USE.md` | Política de uso aceptable |
| `DMCA.md` | Política de retirada DMCA |
| `CONTACT.md` | Datos del responsable (con placeholder del email único) |
| `DATA_SAFETY.md` | **interno.** Plantilla para el formulario de Google Play (modelo gratuito) |
| `SOURCES_OF_FINES.md` | **interno.** Checklist de riesgos regulatorios |
| `STORE_POLICIES.md` | **interno.** Checklist de cumplimiento de tiendas |
| `THIRD_PARTY_LICENSES.md` | Inventario de licencias OSS |

La Aplicación se distribuye **gratuita, sin anuncios y sin compras**.
Para reactivar la monetización, sigue los pasos de
`docs/publicacion-comercial/README.md`.

⚠️ Todos los textos son **modelos informativos**. El Desarrollador
debe rellenarlos con sus datos reales (ver `[TU_*]` en
`legal/CONTACT.md`) y revisarlos con un abogado antes del primer
release en producción.

---

## 🛠️ Desarrollo

### Modo dev (con auto-reload)

```bash
cd src-tauri
cargo tauri dev
```

Esto abre la app con WebView en una ventana nativa y recarga al
detectar cambios.

### Añadir un comando Tauri nuevo

1. Añade la función `#[tauri::command]` en `src-tauri/src/lib.rs`.
2. Regístrala en `tauri::generate_handler![]` al final del mismo
   archivo.
3. Declara los permisos necesarios en
   `src-tauri/capabilities/default.json` si el comando accede a
   APIs restringidas.
4. Llámala desde el frontend con:
   ```js
   await window.__TAURI__.core.invoke('nombre_del_comando', { args });
   ```

---

## 🔒 Permisos del WebView y CSP

La app concede al WebView **solo lo que usa**. Regla del proyecto:

> **Todo permiso que se concede tiene que corresponder a un plugin que
> el frontend usa de verdad.** Si no se usa, no se concede (y no se
> registra el plugin).

### Plugins

| Plugin | ¿Se usa? | Dónde |
|--------|----------|-------|
| `core` | Sí | `invoke`, eventos (`window.__TAURI__.core`) |
| `shell` | Sí | abrir enlaces externos (Legal, "quitar anuncios") |
| `admob` | Sí | anuncios **nativos** de Android (`capabilities/mobile.json`) |
| `fs` | **No** | la importación/exportación usa `Blob`/`FileReader` y el PDF usa html2pdf |
| `dialog` | **No** | igual que `fs`: no hay ningún diálogo nativo |

`fs` y `dialog` se quitaron de `src-tauri/capabilities/default.json`,
de `src-tauri/src/lib.rs` y de `src-tauri/Cargo.toml` (T-032). Con
`withGlobalTauri: true` (que **se queda**: el frontend usa
`window.__TAURI__`) y los scripts remotos de AdSense en el mismo
WebView, conceder acceso al disco sin uso era un riesgo innecesario.

La comprobación automática es `tests/unit/permisos.test.mjs`: falla si
vuelve a aparecer un permiso concedido sin usar (incluye `fs` y
`dialog`), si `lib.rs` registra un plugin que el frontend no usa, o si
`Cargo.toml` vuelve a depender de `tauri-plugin-fs`/`-dialog`.
`tests/e2e/specs/13-permisos.spec.mjs` lo comprueba además en la app
real.

### CSP: los hosts de AdSense solo si la build lleva anuncios

La CSP de `tauri.conf.json` es estática, pero Tauri permite
sobrescribirla en tiempo de compilación con la variable de entorno
`TAURI_CONFIG`. `src-tauri/build.rs` lo hace:

- **Build sin claves de AdSense** (lo normal: `provider: "none"` en
  `src/ads.rs`): la CSP **no permite ningún host de Google**. Es el
  valor por defecto de `tauri.conf.json`.
- **Build con `GOOGLE_ADSENSE_CLIENT`**: la CSP permite los hosts de
  AdSense (el script de anuncios es lo único remoto que carga la app).

Las dos variantes están en `src-tauri/csp.json`; `build.rs` elige una y
la inyecta. Los anuncios de AdMob (Android) son **nativos**, así que en
Android la CSP va siempre sin hosts remotos.

---

## 🤖 Servidor MCP local y su token

En **Ajustes › Asistente (MCP)** se puede encender un servidor MCP
local (solo escritorio) para que un asistente (Claude, u otro cliente
MCP) lea y modifique el plan del usuario.

### Dónde vive el token

El token Bearer es lo único que da acceso al plan, así que **no lo
genera ni lo guarda el navegador**:

- Lo genera la **capa nativa** con entropía criptográfica
  (`getrandom`) y lo guarda en un fichero dentro del directorio de
  datos de la app, con permisos **0600** (solo el usuario).
- El frontend lo **pide** a Rust (`invoke('mcp_token')`) para poder
  mostrarlo en el campo de la pestaña y para arrancarlo con
  `mcp_start`. En el `localStorage` solo queda el interruptor y el
  puerto: **ni el token ni una copia de él**.
- El botón "Regenerar" crea uno nuevo; el anterior deja de servir al
  instante (el servidor vivo cambia de token sin reiniciarse).

El token se guarda **en disco a propósito**: el usuario lo pega en un
comando `claude mcp add … --header "Authorization: Bearer <token>"`, y
si al reiniciar la app el token fuera otro, su cliente dejaría de
funcionar.

> **Al actualizar a una versión con el token nativo, hay que volver a
> copiar el comando**: el token antiguo estaba en el `localStorage` del
> navegador y se descarta (se borra al migrar el estado guardado).

---

## 📜 Licencia

El código fuente se distribuye bajo los términos del archivo
`legal/LICENSE` (MIT por defecto). El usuario puede redistribuirlo y
modificarlo respetando esa licencia.

---

*Esta versión del proyecto es un envoltorio nativo de la PWA original.
El comportamiento de usuario (tareas, hábitos, PDF, etc.) es idéntico
al de la versión web.*