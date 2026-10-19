# Planificador Semanal — versión Tauri

Planificador semanal con tareas recurrentes, ciclos personalizados y
exportación a PDF. **Funciona 100 % local; sin servidor ni cuentas.**

Esta es la versión **Tauri 2** del proyecto original (que era una PWA).
Permite distribuir la app como:

| Plataforma | Formato | Tienda / distribución |
|------------|---------|-----------------------|
| Linux | `.AppImage`, `.deb` | Web del Desarrollador (sin tienda central) |
| Windows | `.exe` (NSIS) | Web del Desarrollador + (opcional) Microsoft Store como `.msix` |
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
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs       ← entry point del binario
│   │   └── lib.rs        ← comandos + builder de Tauri
│   ├── icons/            ← iconos generados para cada plataforma
│   └── capabilities/
│       └── default.json  ← permisos del WebView
└── tools/                ← scripts de build por plataforma
    ├── build-linux.sh
    ├── build-windows.ps1
    ├── build-msix.ps1
    └── build-android.sh
```

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

./tools/build-linux.sh
# → src-tauri/target/release/bundle/Planificador Semanal_*.AppImage
# → src-tauri/target/release/bundle/planner_*.deb
```

### Windows (instalador NSIS .exe)

En una máquina con Windows + Visual Studio 2022:

```powershell
PS> .\tools\build-windows.ps1
# → src-tauri\target\release\bundle\Planificador Semanal_*.exe
```

### Microsoft Store (MSIX)

Tauri 2 no produce MSIX directamente. Flujo recomendado:

```powershell
PS> .\tools\build-windows.ps1                            # 1) .exe NSIS
PS> cargo install cargo-msix --locked                    # 2) herramienta
PS> .\tools\build-msix.ps1 -ExePath "src-tauri\target\release\bundle\*.exe"
# → dist\Planificador Semanal_0.1.0_x64.msix
```

### Android (APK / AAB)

Requisitos: Android Studio (SDK + NDK), Java 17, keystore.

```bash
# Solo la primera vez
cargo tauri android init

# Build APK release
./tools/build-android.sh

# Build AAB (Play Store)
./tools/build-android.sh --aab
```

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
- Ambas vacías → la app funciona sin anuncios, aunque el usuario no
  haya comprado la versión premium.

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
| `COOKIES.md` | Política de cookies y consentimiento |
| `REFUNDS.md` | Política de reembolsos |
| `ACCESSIBILITY.md` | Declaración de accesibilidad WCAG 2.1 AA |
| `ACCEPTABLE_USE.md` | Política de uso aceptable |
| `DMCA.md` | Política de retirada DMCA |
| `ADS_DISCLOSURE.md` | Aviso de publicidad |
| `CONTACT.md` | Datos del responsable (plantilla con placeholders) |
| `DATA_SAFETY.md` | Plantilla para el formulario de Google Play |
| `SOURCES_OF_FINES.md` | **interno.** Checklist de riesgos regulatorios |
| `STORAGE_POLICIES.md` | **interno.** Checklist de cumplimiento de tiendas |
| `THIRD_PARTY_LICENSES.md` | Inventario de licencias OSS |

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

## 📜 Licencia

El código fuente se distribuye bajo los términos del archivo
`legal/LICENSE` (MIT por defecto). El usuario puede redistribuirlo y
modificarlo respetando esa licencia.

---

*Esta versión del proyecto es un envoltorio nativo de la PWA original.
El comportamiento de usuario (tareas, hábitos, PDF, etc.) es idéntico
al de la versión web.*