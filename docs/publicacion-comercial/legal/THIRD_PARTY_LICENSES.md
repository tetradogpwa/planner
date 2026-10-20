# Licencias de terceros

**Última actualización:** 16 de octubre de 2026

Este archivo lista todas las dependencias de terceros que el Software
utiliza en tiempo de ejecución o empaqueta en sus binarios, junto con
sus licencias. Se publica para cumplir los requisitos de atribución
de las propias licencias.

---

## 1. Software empaquetado

| Dependencia | Licencia | Fuente | Notas |
|-------------|----------|--------|-------|
| **html2pdf.js** v0.10.1 | MIT | https://github.com/eKoopmans/html2pdf.js | Distribuida en `vendor/html2pdf.bundle.min.js` |
| **Tauri** v2.x | MIT / Apache-2.0 | https://github.com/tauri-apps/tauri | Runtime de la aplicación nativa |
| **WebView2** (Windows) | Microsoft Software License Terms | https://developer.microsoft.com/microsoft-edge/webview2/ | Redistribuido por el propio Tauri |
| **WebKitGTK** (Linux) | LGPL 2.1+ | https://webkitgtk.org/ | Redistribuido por el propio Tauri |
| **AndroidX WebKit** (Android) | Apache-2.0 | https://developer.android.com/ | Redistribuido por el propio Tauri |

### Texto resumido de la licencia MIT (html2pdf.js)

> Copyright (c) 2016-2024 eKoopmans
>
> Por la presente se concede permiso, sin cargo alguno, a cualquier
> persona que obtenga una copia de este software y archivos de
> documentación asociados (el "Software"), a utilizar el Software sin
> restricción, incluyendo sin limitación los derechos de uso, copia,
> modificación, fusión, publicación, distribución, sublicenciamiento
> y/o venta de copias del Software, y a permitir a las personas a las
> que se les proporcione el Software a hacer lo mismo, sujeto a las
> condiciones de la licencia MIT estándar.

El texto completo de la licencia MIT está disponible en:

- https://opensource.org/license/mit/
- Distribuido junto a `html2pdf.bundle.min.js` en su archivo `.LICENSE.txt`
  generado por el bundler.

## 2. Servicios externos (carga dinámica, solo con consentimiento)

Estos servicios **no se incluyen en el binario**. Se cargan desde sus
CDN oficiales **solo si** el usuario acepta el banner de cookies:

| Servicio | Licencia / Términos | URL |
|----------|---------------------|-----|
| Google AdSense | Términos de Google | https://policies.google.com/terms |
| Google AdMob | Términos de Google | https://policies.google.com/terms |

## 3. Iconos y assets gráficos

| Asset | Licencia | Origen |
|-------|----------|--------|
| `icon-192x192.png` | Propiedad del Desarrollador | A confirmar por el Desarrollador |
| `icon-512x512.png` | Propiedad del Desarrollador | A confirmar por el Desarrollador |

Si en algún momento se usan fuentes de iconos open source
(por ejemplo, Material Symbols, Font Awesome), añadir aquí la licencia
correspondiente.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*