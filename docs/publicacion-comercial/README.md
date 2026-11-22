# Cómo reactivar la monetización del Planificador Semanal

Esta carpeta contiene una copia de seguridad de los textos legales
del proyecto tal y como estaban **antes** de la decisión de publicar
la aplicación como gratuita y sin anuncios (tarea T-023 del 19 de
octubre de 2026).

> **Estado actual:** la app distribuida es **gratuita, sin anuncios,
> sin compras y 100 % local**. Todo lo descrito en esta carpeta está
> **desactivado**.

Los textos de esta carpeta **no se incluyen en el binario** ni en la
vista *Ajustes › Legal* de la app. Solo sirven como guía para el
momento en que el Desarrollador decida pasar a ser comerciante
(autónomo / empresa) y reactivar los anuncios y la versión de pago.

---

## 1. Restaurar los textos legales

Copia los `.md` y el `LICENSE` desde `legal/` de esta carpeta a la
carpeta `legal/` de la raíz del proyecto, **sobrescribiendo** los
archivos gratuitos actuales:

```bash
cp docs/publicacion-comercial/legal/PRIVACY.md              legal/PRIVACY.md
cp docs/publicacion-comercial/legal/TERMS.md                legal/TERMS.md
cp docs/publicacion-comercial/legal/EULA.md                 legal/EULA.md
cp docs/publicacion-comercial/legal/COOKIES.md              legal/COOKIES.md
cp docs/publicacion-comercial/legal/ACCEPTABLE_USE.md       legal/ACCEPTABLE_USE.md
cp docs/publicacion-comercial/legal/THIRD_PARTY_LICENSES.md legal/THIRD_PARTY_LICENSES.md
cp docs/publicacion-comercial/legal/ACCESSIBILITY.md        legal/ACCESSIBILITY.md
cp docs/publicacion-comercial/legal/DMCA.md                 legal/DMCA.md
cp docs/publicacion-comercial/legal/LICENSE                 legal/LICENSE
```

`ADS_DISCLOSURE.md` y `REFUNDS.md` también están aquí, pero como
estos textos **se habían quitado de la vista Legal** al pasar a
gratis, hay que darlos de alta otra vez en la lista de documentos y
en los recursos del binario (ver siguiente apartado).

## 2. Restaurar ADS_DISCLOSURE y REFUNDS

1. Mueve los archivos de vuelta a `legal/`:

   ```bash
   cp docs/publicacion-comercial/legal/ADS_DISCLOSURE.md legal/ADS_DISCLOSURE.md
   cp docs/publicacion-comercial/legal/REFUNDS.md       legal/REFUNDS.md
   ```

2. En `ui/legal/legal-card.js`, vuelve a listar los dos documentos en
   el objeto `DOCS`:

   ```js
   ADS_DISCLOSURE: { title: 'Aviso de publicidad', file: './legal/ADS_DISCLOSURE.md' },
   REFUNDS:        { title: 'Reembolsos',          file: './legal/REFUNDS.md' },
   ```

3. En `ui/legal/legal-card.html`, vuelve a añadir los dos enlaces a
   la lista de documentos.

4. En `src-tauri/tauri.conf.json`, dentro de `bundle.resources`,
   añade las dos entradas que faltan:

   ```json
   "../legal/ADS_DISCLOSURE.md": "legal/ADS_DISCLOSURE.md",
   "../legal/REFUNDS.md":        "legal/REFUNDS.md",
   ```

5. En Play Console: vuelve a abrir la sección **Ads Disclosure** si
   la habías cerrado.

## 3. Rellenar las claves de anuncios y la versión de pago

Edita `.env` (en la raíz del repo, **no** en el repositorio) y
descomenta las variables que correspondan. Sus valores se
incrustan en el binario al compilar (`src-tauri/build.rs` →
`src-tauri/src/ads.rs`):

```bash
# Escritorio (AdSense dentro del WebView)
GOOGLE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
GOOGLE_ADSENSE_SLOT=YYYYYYYYYY

# Android (AdMob nativo)
GOOGLE_ADMOB_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
GOOGLE_ADMOB_BANNER_ID=ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ
GOOGLE_ADMOB_INTERSTITIAL_ID=ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWWW
```

Cada build solo lee las de su plataforma (ver `ads.rs`):

- **Linux / Windows:** AdSense
- **Android:** AdMob

Si las claves de la plataforma están vacías, esa build sale como
`provider: "none"` (la pantalla de consentimiento y el botón *Quitar
anuncios* no aparecen).

**Ojo:** si NO hay ninguna clave de anuncios (ni de AdSense ni de AdMob),
el build **falla** (`src-tauri/build.rs`): no se publica una app sin
monetizar ni sin aviso, y en Android no se lleva el App ID de prueba de
Google. Si de verdad quieres una build sin anuncios (la versión de pago,
por ejemplo), compílala con `ALLOW_NO_ADS=1`:

```bash
ALLOW_NO_ADS=1 cargo tauri build
```

Añade también los enlaces a la versión de pago, que la app ofrece
al usuario cuando rechaza los anuncios:

```bash
PAID_VERSION_URL_DESKTOP=https://tu-web.example/planner-pro
PAID_VERSION_URL_ANDROID=https://play.google.com/store/apps/details?id=tu.paquete.pro
```

Tras editar `.env` hay que **recopilar** el binario: las claves se
incrustan en compilación, no se leen en tiempo de ejecución.

## 4. Completar CONTACT.md con los datos del comerciante

`legal/CONTACT.md` se había dejado con un único *placeholder*
(`[TU_EMAIL_CONTACTO]`) para evitar publicar nombre legal, NIF y
domicilio. Restáuralo con los datos reales del Desarrollador
(autónomo o empresa):

1. Restaura la copia guardada en esta carpeta:

   ```bash
   cp docs/publicacion-comercial/legal/CONTACT.md legal/CONTACT.md
   ```

2. Edita `legal/CONTACT.md` y rellena los campos:

   - `Nombre legal`
   - `NIF / CIF / equivalente`
   - `Domicilio fiscal`
   - `País de residencia`
   - `Correo de contacto` (y privacidad, si quieres uno distinto)
   - `Sitio web`

3. Asegúrate también de que los mismos emails aparecen en
   `legal/PRIVACY.md` y `legal/ACCESSIBILITY.md` (donde estén como
   `[TU_EMAIL_*]`).

## 5. Revisar los textos con un abogado y publicar

Antes de subir la app a Google Play o Microsoft Store:

1. Pasa todos los textos de `legal/` por un **abogado** de tu
   jurisdicción (especialmente `SOURCES_OF_FINES.md`, que ahora
   refleja el modelo gratuito y hay que actualizar).
2. Actualiza la fecha **Última actualización** de `TERMS.md` y
   `EULA.md` (la app la lee para volver a pedir los términos).
3. Actualiza `DATA_SAFETY.md` con las nuevas secciones C y D
   (anuncios y compras) y súbelas al Play Console.
4. Actualiza `STORE_POLICIES.md` (§ 4 — política de anuncios y
   compras por tienda).
5. Configura las URLs públicas estables de los textos
   (`https://tu-dominio/legal/<doc>.html`) según `CONTACT.md` § 5.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1    | Copiar los `.md` y `LICENSE` de esta carpeta a `legal/` |
| 2    | Devolver `ADS_DISCLOSURE.md` y `REFUNDS.md` a `legal/`, listarlos en `legal-card.{js,html}` y declararlos en `tauri.conf.json` |
| 3    | Rellenar `.env` con las claves de AdSense/AdMob y `PAID_VERSION_URL_*`, y **recopilar** |
| 4    | Rellenar los datos fiscales en `legal/CONTACT.md` (y `PRIVACY.md`, `ACCESSIBILITY.md` si usas emails distintos) |
| 5    | Revisar todo con un abogado, actualizar fechas y publicar |

---

*Documento interno. No distribuir con la app.*
