# Cumplimiento de políticas de tiendas

**Última actualización:** 16 de octubre de 2026

> Documento **interno** del repositorio. Sirve como checklist antes
> de cada release. No se distribuye con la app.

---

## 1. Google Play Store

### 1.1 Requisitos técnicos

| Requisito | Estado actual | Notas |
|-----------|---------------|-------|
| `targetSdkVersion` ≥ mínimo exigido por Play | usar el del año en curso | Tauri 2 sigue el target SDK actual por defecto |
| `minSdkVersion` declarado | 24 (Android 7.0) | configurado en `src-tauri/tauri.conf.json` |
| 64-bit nativo (arm64-v8a) | ✅ | Tauri produce ambos por defecto |
| Sin permisos peligrosos no justificados | ✅ | La app no pide CAMERA, LOCATION, RECORD_AUDIO, READ_CONTACTS, READ_CALENDAR |
| Política de privacidad enlazada en el listado | ⏳ pendiente de URL pública | Publicar `legal/PRIVACY.md` en una URL estable |
| Sección "Data Safety" rellenada | ⏳ pendiente | Usar `legal/DATA_SAFETY.md` como guía |

### 1.2 Contenido y comportamiento

- La app no reproduce contenido con copyright de terceros.
- La app no muestra anuncios a niños (TAG child-directed desactivado
  por defecto).
- La app no redirige al usuario a una web para completar la compra
  (las IAP pasan por Google Play Billing).
- La app no usa SMS ni llamadas.
- La app no accede a `AccountManager`.

### 1.3 Metadata

- Título, descripción corta y larga rellenados en `tauri.conf.json`
  (`bundle.shortDescription` / `bundle.longDescription`).
- Iconos generados desde `icons/` (mipmap-mdpi a xxxhdpi).
- Capturas de pantalla: **pendiente** — aportar antes del primer
  release.

## 2. Microsoft Store (MSIX)

### 2.1 Requisitos técnicos

| Requisito | Estado actual | Notas |
|-----------|---------------|-------|
| Firma con certificado de CA reconocida | ⏳ pendiente | Configurar `MSIX_CERT_THUMBPRINT` en `.env` |
| `Publisher` declarado en el manifest | pendiente | debe coincidir con el sujeto del certificado |
| `PublisherDisplayName` declarado | pendiente | debe coincidir con el del Partner Center |
| `IdentityName` único | `gabriel.cat.developer.planner` | configurar en Partner Center |
| `TargetFramework.Windows` ≥ 10.0.17763.0 | ✅ | Tauri 2 usa TFM 2024 |
| Política de privacidad enlazada en el listado | ⏳ pendiente | Publicar `legal/PRIVACY.md` en una URL estable |

### 2.2 Flujo de packaging

Tauri 2 **no incluye MSIX como target nativo**. Para generar el
paquete Store:

1. Construir el .exe con Tauri NSIS:
   ```
   .\tools\build-windows.ps1
   ```
2. Envolver en MSIX con `cargo-msix`:
   ```
   .\tools\build-msix.ps1 -ExePath "src-tauri\target\release\bundle\*.exe"
   ```
3. Firmar con `signtool` y un certificado válido.
4. Subir el `.msix` al Partner Center.

Alternativamente, mientras no se use Store, distribuir directamente el
`.exe` NSIS:

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

| Tienda | Inserción de anuncios | Compra in-app "Quitar anuncios" |
|--------|-----------------------|--------------------------------|
| Google Play | Google AdMob (gestionado por app) | Google Play Billing |
| Microsoft Store | Google AdSense (vía WebView) | Microsoft Store IAP |
| Web (futuro) | Google AdSense | TPV propio (Stripe/LemonSqueezy) |

La librería `monetization.js` está preparada para los tres casos; la
clave que active los anuncios se decide en tiempo de build según la
plataforma objetivo.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*