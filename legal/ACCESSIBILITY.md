# Declaración de accesibilidad

**Última actualización:** 19 de octubre de 2026

Planificador Semanal se compromete a hacer su aplicación utilizable
por el mayor número de personas posible, incluidas personas con
discapacidad. Esta declaración describe el estado de cumplimiento y
los canales para reportar barreras de accesibilidad.

---

## 1. Marco normativo

Esta declaración se publica en cumplimiento de:

- **Directiva (UE) 2019/882** — European Accessibility Act.
- **Real Decreto 1112/2018** (España), por el que se traspone la
  directiva anterior para productos y servicios digitales del sector
  privado.
- **WCAG 2.1 nivel AA** — estándar técnico de referencia.
- **EN 301 549** — requisitos de accesibilidad para productos y
  servicios TIC en Europa.

## 2. Estado de cumplimiento

| Requisito WCAG 2.1 AA | Estado | Notas |
|------------------------|--------|-------|
| 1.1.1 Contenido no textual (alternativas) | ✅ Cumplido | Iconos de la barra lateral llevan `aria-label` y texto alternativo |
| 1.3.1 Información y relaciones | ✅ Cumplido | La estructura usa HTML semántico (`nav`, `main`, `section`) y ARIA donde es necesario |
| 1.4.3 Contraste mínimo | ⚠️ Parcial | Tema claro y oscuro verifican contraste AA en la mayoría del texto; algunas etiquetas de estado pendientes |
| 1.4.4 Redimensionamiento de texto | ✅ Cumplido | El layout se adapta a `font-size` del navegador |
| 1.4.10 Reflow | ✅ Cumplido | Diseño responsive sin scroll horizontal a 320 CSS px |
| 1.4.11 Non-text contrast | ⚠️ Parcial | Pendiente revisar bordes de inputs en ambos temas |
| 2.1.1 Teclado | ✅ Cumplido | Todos los controles son accesibles con teclado; ver checklist pre-release |
| 2.1.2 Sin trampas de teclado | ✅ Cumplido | No hay foco atrapado |
| 2.4.3 Orden del foco | ✅ Cumplido | Sigue el orden visual |
| 2.4.6 Etiquetas y nombres | ✅ Cumplido | Todos los `input` tienen `<label>` o `aria-label` |
| 2.4.7 Foco visible | ✅ Cumplido | Foco con outline visible |
| 2.5.3 Etiqueta en el nombre | ✅ Cumplido | El nombre accesible coincide con el texto visible |
| 3.1.1 Idioma de la página | ✅ Cumplido | `<html lang="es">` |
| 3.2.1 Al recibir foco | ✅ Cumplido | No hay cambios de contexto al recibir foco |
| 3.2.2 Al cambiar configuración | ✅ Cumplido | Sin cambios automáticos de contexto |
| 3.3.1 Identificación de errores | ✅ Cumplido | Inputs con `aria-invalid` y mensaje de error |
| 3.3.2 Etiquetas o instrucciones | ✅ Cumplido | Cada input tiene su propósito claro |
| 4.1.2 Nombre, función, valor | ✅ Cumplido | Componentes personalizados exponen estado vía ARIA |

Estado general: **parcialmente conforme** con WCAG 2.1 AA. Las
carencias listadas están programadas para resolverse en próximas
versiones.

## 3. Limitaciones conocidas

- **Exportación a PDF:** el motor actual (`html2pdf.js`) genera un
  PDF que hereda la maquetación de la vista de impresión. La
  accesibilidad del PDF depende de las opciones que se pasen al
  motor; actualmente **no se embeben etiquetas de accesibilidad**.

## 4. Compatibilidad con tecnologías de asistencia

La Aplicación ha sido probada con:

- Lector de pantalla **NVDA** en Firefox/Chromium.
- Lector de pantalla **VoiceOver** en macOS.
- Navegación por teclado puro (Tab, Shift+Tab, Enter, Espacio, flechas).

La Aplicación **no requiere** lector de pantalla para su uso
principal, pero la combinación de teclado + lector de pantalla es
el método recomendado para usuarios con discapacidad visual.

## 5. Atajos de teclado

La aplicación se puede usar íntegramente con el teclado. Los atajos
globales están disponibles desde cualquier vista (los que usan
`Alt` funcionan también dentro de campos de texto).

### Navegación entre vistas (Alt + número)

| Combinación | Acción |
|-------------|--------|
| `Alt` + `1` | Ir a Gestión de tareas |
| `Alt` + `2` | Ir a Semana actual |
| `Alt` + `3` | Ir a Todas las semanas |
| `Alt` + `4` | Ir a **Ajustes › Datos** |
| `Alt` + `5` | Ir a **Ajustes › Imprimir y PDF** |
| `Alt` + `6` | Ir a **Ajustes › Apariencia** |
| `Alt` + `7` | Ir a **Ajustes › Legal** |
| `Alt` + `8` | Ir a **Ajustes › Accesibilidad** |

### Menú lateral

| Combinación | Acción |
|-------------|--------|
| `Flecha arriba` / `Flecha abajo` | Mover el foco entre opciones |
| `Inicio` / `Fin` | Primera / última opción |
| `Enter` / `Espacio` | Abrir la opción enfocada |

Además, hay un enlace **"Saltar al contenido"** que aparece al
recibir foco y lleva directamente al área principal de la vista.

### Pestañas de términos (al inicio)

| Combinación | Acción |
|-------------|--------|
| `Flecha izquierda` / `Flecha derecha` | Cambiar entre pestañas |
| `Inicio` / `Fin` | Primera / última pestaña |

### Vista Semana

| Combinación | Acción |
|-------------|--------|
| `Flecha arriba` / `Flecha abajo` | Mover el foco entre cabeceras de día |
| `Enter` / `Espacio` | Abrir o cerrar el día enfocado |

### Atajos de edición de tareas

| Combinación | Acción |
|-------------|--------|
| `Alt` + `N` | Enfocar el nombre de la nueva tarea |

### Ayuda

| Combinación | Acción |
|-------------|--------|
| `?` | Abre esta ayuda (fuera de campos de texto) |
| `Esc` | Cierra cualquier diálogo abierto |

La ayuda también está disponible desde **Ajustes › Accesibilidad**
de la barra lateral.

## 6. Cómo reportar una barrera

Si encuentras una barrera de accesibilidad o quieres solicitar el
contenido en un formato alternativo, escríbenos a:

- **Correo:** `[TU_EMAIL_CONTACTO]` (canal único, válido para
  privacidad, consultas generales y accesibilidad).
- **Plazo de respuesta objetivo:** 5 días hábiles.

Por favor, incluye:

1. La página, vista o componente afectado.
2. La tecnología de asistencia que usas (lector de pantalla, tipo de
   teclado, magnificador, etc.).
3. El navegador o plataforma.
4. Una breve descripción del problema y, si es posible, pasos para
   reproducirlo.

## 7. Compromiso de mejora continua

El Desarrollador revisará esta declaración en cada release mayor y
publicará los avances en el repositorio del proyecto.

---

## Control por asistente (MCP local)

La Aplicación incorpora, opcionalmente, un servidor local compatible
con [Model Context Protocol](https://modelcontextprotocol.io/) que
permite a un asistente de IA controlar el plan. Esto es una
**característica de accesibilidad**: una persona que no pueda usar
la interfaz manualmente (por una discapacidad motora o visual)
puede manejar el plan pidiéndoselo a su asistente. El servidor:

- **Está desactivado por defecto** y solo escucha en `127.0.0.1`,
  no en interfaces de red públicas.
- **Exige autenticación** con un token Bearer aleatorio de 64
  caracteres generado por la propia Aplicación; el usuario puede
  regenerarlo cuando quiera.
- **No está disponible en Android** (la sección de Ajustes
  correspondiente lo indica claramente).
- Mientras esté desactivado, el puerto está cerrado.

### Quién ve los datos cuando lo activas

El servidor MCP de la Aplicación es solo un **puente local** entre
el asistente y el plan. El Desarrollador **no recibe** lo que el
asistente lea o escriba. Lo que el asistente haga con esos datos
depende del proveedor del asistente: por ejemplo, si usas Claude,
Anthropic trata el contenido del diálogo según
[sus políticas](https://www.anthropic.com/privacy); el Desarrollador
ni siquiera ve métricas. Antes de activar esta función, revisa la
política de privacidad del asistente que vayas a usar.

### Seguridad del token

El token da acceso completo al plan (leer, crear, editar y borrar
tareas y la fecha de inicio). **No lo compartas** con nadie ni lo
peges en chats: quien lo tenga puede tratar el plan como si fueras
tú. Si sospechas que se ha filtrado, regenera el token desde
**Ajustes › Asistente (MCP)** → "Regenerar": el token viejo deja
de funcionar de inmediato.

El usuario puede activar y desactivar el servidor en cualquier
momento desde **Ajustes › Asistente (MCP)**.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*