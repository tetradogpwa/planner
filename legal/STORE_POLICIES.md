# Cumplimiento de políticas de tiendas

**Última actualización:** 22 de noviembre de 2026

> Documento **interno** del repositorio. Sirve como checklist antes
> de cada release. No se distribuye con la app.

La Aplicación se distribuye como **gratuita, sin anuncios, sin
compras y 100 % local**. Mientras se mantenga este modelo, las
secciones de cada tienda son más simples: no hay *Data Safety* con
anuncios, no hay *Ads Disclosure*, no hay declaración de comerciante.

---

## 1. Google Play Store

### 1.1 Requisitos técnicos

| Requisito | Estado actual | Notas |
|-----------|---------------|-------|
| `targetSdkVersion` ≥ mínimo exigido por Play | usar el del año en curso | Tauri 2 sigue el target SDK actual por defecto |
| `minSdkVersion` declarado | 24 (Android 7.0) | configurado en `src-tauri/tauri.conf.json` |
| 64-bit nativo (arm64-v8a) | ✅ | Tauri produce ambos por defecto |
| Sin permisos peligrosos no justificados | ✅ | La app no pide CAMERA, LOCATION, RECORD_AUDIO, READ_CONTACTS, READ_CALENDAR, INTERNET para anuncios |
| Política de privacidad enlazada en el listado | ⏳ pendiente de URL pública | Publicar `legal/PRIVACY.md` en una URL estable |
| Sección "Data Safety" rellenada | ⏳ pendiente | Usar `legal/DATA_SAFETY.md` como guía |
| Cuenta declarada como **no comerciante** | sí | Mientras la app siga siendo gratuita y sin anuncios |

### 1.2 Contenido y comportamiento

- La app no reproduce contenido con copyright de terceros.
- La app no muestra anuncios a niños (la app no muestra anuncios en
  absoluto, dado el modelo gratuito).
- La app no redirige al usuario a una web para completar la compra
  (no hay IAP en la versión actual).
- La app no usa SMS ni llamadas.
- La app no accede a `AccountManager`.

### 1.3 Metadata

- Título, descripción corta y larga rellenados en `tauri.conf.json`
  (`bundle.shortDescription` / `bundle.longDescription`).
- Iconos generados desde `icons/` (mipmap-mdpi a xxxhdpi).
- Capturas de pantalla: **pendiente** — aportar antes del primer
  release.

## 2. Microsoft Store (instalador `.exe` firmado)

### 2.1 Requisitos técnicos

| Requisito | Estado actual | Notas |
|-----------|---------------|-------|
| Firma con certificado de CA reconocida | ⏳ pendiente | `bundle.windows.certificateThumbprint` en `src-tauri/tauri.conf.json` (hoy es el placeholder `[TU_THUMBPRINT_CERTIFICADO_NSIS]`) |
| `Publisher` declarado en el manifest | pendiente | debe coincidir con el sujeto del certificado |
| `PublisherDisplayName` declarado | pendiente | debe coincidir con el del Partner Center |
| `IdentityName` único | `gabriel.cat.developer.planner` | configurar en Partner Center |
| `TargetFramework.Windows` ≥ 10.0.17763.0 | ✅ | Tauri 2 usa TFM 2024 |
| Política de privacidad enlazada en el listado | ⏳ pendiente | Publicar `legal/PRIVACY.md` en una URL estable |

### 2.2 Flujo de packaging

Tauri 2 **no incluye MSIX como target nativo**: solo genera
instaladores `.exe` (NSIS) y `.msi` (WiX). El crate `cargo-msix`
existe, pero su README dice que nada funciona todavía, así que hoy
**no hay forma de generar un `.msix` con este proyecto**.

El flujo que sí funciona es subir el **`.exe` NSIS firmado** al
Partner Center como producto de tipo "EXE or MSI app":

1. Construir el instalador en Windows, con el certificado (la Store
   exige firma):
   ```
   bash tools/build.sh windows
   ```
   La firma la hace Tauri con `signtool` a partir del thumbprint de
   `bundle.windows.certificateThumbprint`.
2. Usar el instalador **offline** de WebView2 (`webviewInstallMode:
   offlineInstaller`) con una configuración aparte:
   ```
   cargo tauri build --config src-tauri/tauri.microsoftstore.conf.json
   ```
3. Declarar `/S` como parámetro de instalación silenciosa (NSIS). Sin
   él, la Store rechaza el envío.
4. Subir el `.exe` al Partner Center.

Mientras no se use la Store, se distribuye directamente el `.exe` NSIS:

- Doble clic → instala.
- Soporta auto-update vía `tauri-plugin-updater` (no habilitado aún).

## 3. Distribución Linux (AppImage / .deb)

Linux **no tiene tienda central**. La distribución se hace desde la
web del Desarrollador:

- `Planificador Semanal_x.y.z_amd64.AppImage` (ejecutable portable).
- `planner_x.y.z_amd64.deb` (Debian / Ubuntu).

### 3.1 Requisitos de la distro

- `AppImage` no requiere instalación, pero el host debe tener
  `libwebkit2gtk-4.1-0` (versión moderna de WebKitGTK).
- `.deb` declara la dependencia `libwebkit2gtk-4.1-0` en su control
  file.

### 3.2 Metadata

- AppStream metadata (`planner.metainfo.xml`) — **pendiente** crear
  para que `plasma-discoverer`/`gnome-software` reconozcan el
  AppImage.

## 4. Política de anuncios y compras en cada tienda

**Modelo actual:** la app es gratuita y no muestra anuncios ni
ofrece compras en ninguna tienda. Cada tienda se publica sin IAP
ni redes publicitarias.

> Cuando el Desarrollador reactive la monetización, esta sección se
> ampliará para indicar qué tienda usa qué red publicitaria y qué
> tienda procesa las compras (Google Play Billing en Android,
> Microsoft Store IAP en Windows, etc.). Ver
> `docs/publicacion-comercial/README.md`.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*
