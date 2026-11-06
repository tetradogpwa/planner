# Textos legales de Planificador Semanal

Esta carpeta contiene todos los textos legales del proyecto.

> ⚠️ **AVISO IMPORTANTE — MODELOS.**
> Todos los textos de esta carpeta son **modelos informativos**, no
> asesoramiento jurídico profesional. Antes de publicar la app en
> cualquier tienda, el Desarrollador debería revisarlos con un abogado
> de su jurisdicción.
>
> El email único para privacidad, contacto general y accesibilidad es
> gabriel.cat.developer+planner@gmail.com (está en `CONTACT.md`,
> `PRIVACY.md` y `ACCESSIBILITY.md`).

> **Modelo actual:** la app se distribuye **gratuita, sin anuncios,
> sin compras y 100 % local**. Los textos siguientes están adaptados
> a ese modelo. Si en el futuro el Desarrollador decide reactivar la
> monetización (ver `docs/publicacion-comercial/README.md`), debe
> restaurar aquí las versiones con anuncios guardadas en
> `docs/publicacion-comercial/legal/`.

---

## Inventario

| Archivo | Para qué sirve | Obligatorio en… |
|---------|----------------|-----------------|
| `PRIVACY.md` | Política de privacidad (RGPD, CCPA/CPRA, LGPD) adaptada al modelo gratuito | Google Play, Microsoft Store, web pública |
| `TERMS.md` | Términos generales de uso (sin anuncios ni compras) | Web pública |
| `EULA.md` | Contrato de licencia de usuario final (sin anuncios ni compras) | Microsoft Store (MSIX), opcional en Google Play |
| `COOKIES.md` | Política de cookies y almacenamiento local (sin redes publicitarias) | Web pública, webview de escritorio |
| `DMCA.md` | Política de retirada de contenido | Microsoft Store |
| `ACCESSIBILITY.md` | Declaración de accesibilidad (WCAG 2.1 AA) | Web pública (UE), opcional en stores |
| `ACCEPTABLE_USE.md` | Política de uso aceptable y edad mínima (sin sección de anuncios) | Google Play, Microsoft Store |
| `CONTACT.md` | Datos del responsable (sin datos fiscales; solo nombre comercial, marca y email único) | Todos (especialmente para AEPD/LSSI) |
| `DATA_SAFETY.md` | **Interno.** Plantilla para el formulario Data Safety del Play Console (modelo "sin datos, sin anuncios") | Google Play |
| `STORE_POLICIES.md` | **Interno.** Cumplimiento específico de cada tienda (cuenta no comerciante) | Repositorio |
| `SOURCES_OF_FINES.md` | **Interno.** Checklist de fuentes de multas y riesgos | Repositorio (no se distribuye) |
| `THIRD_PARTY_LICENSES.md` | Inventario de licencias de terceros (sin servicios externos de anuncios) | Repositorio (no se distribuye) |
| `LICENSE` | Licencia de código fuente del Desarrollador | Repositorio |
| `README.md` | Este archivo | — |

> **Nota histórica.** Los antiguos documentos `ADS_DISCLOSURE.md` y
> `REFUNDS.md` ya no se distribuyen (la app no muestra anuncios ni
> permite compras). Sus versiones con anuncios se conservan en
> `docs/publicacion-comercial/legal/` por si en el futuro hay que
> reactivarlos.

## Cómo usarlos

1. **Mantén** el correo de contacto (gabriel.cat.developer+planner@gmail.com)
   igual en `CONTACT.md`, `PRIVACY.md` y `ACCESSIBILITY.md`.
2. **Publica** las versiones `.md` en tu web como `.html`
   (cualquier *static site renderer* tipo GitHub Pages sirve).
3. **Mantén activas** las direcciones públicas de la política de
   privacidad (ver "Direcciones públicas" más abajo).
4. **Antes de cada release**, revisa `SOURCES_OF_FINES.md` (sección
   18 — checklist pre-release).

## Idiomas

Estos modelos están en **español**, alineados con la UI de la app.

Si publicas en mercados no hispanohablantes:

- Considera traducir al menos `PRIVACY.md`, `TERMS.md`, `COOKIES.md`
  y `EULA.md` al inglés y al idioma local del mercado objetivo.
- Las tiendas **no exigen** traducción a todos los idiomas, pero sí
  que el idioma por defecto esté disponible y sea el declarado en el
  listado de la tienda.

## Direcciones públicas

Google Play y Microsoft Store piden la **URL pública** de la política
de privacidad (y conviene publicar también los términos). No hace falta
dominio propio: sirve un subdominio gratuito (GitHub Pages
`usuario.github.io`, Google Sites…). Cada URL debe responder 200 OK y
mostrar la última versión del `.md` correspondiente:

- política de privacidad → `legal/PRIVACY.md`
- términos de uso → `legal/TERMS.md`
- contrato de licencia → `legal/EULA.md`
- cookies → `legal/COOKIES.md`
- accesibilidad → `legal/ACCESSIBILITY.md`
- contacto → `legal/CONTACT.md`

Estas son las direcciones que publica la app y que abre en el navegador
del sistema desde **Ajustes › Legal** (la app no descarga nada: solo
pide al sistema que abra la URL). Viven en un único sitio, el archivo
`ui/legal/legal-urls.js`:

| Documento | URL pública |
|-----------|------------|
| `PRIVACY` | https://gabrielcatdeveloper.github.io/papeleo/planner/PRIVACY |
| `TERMS` | https://gabrielcatdeveloper.github.io/papeleo/planner/TERMS |
| `EULA` | https://gabrielcatdeveloper.github.io/papeleo/planner/EULA |
| `COOKIES` | https://gabrielcatdeveloper.github.io/papeleo/planner/COOKIES |
| `ACCESSIBILITY` | https://gabrielcatdeveloper.github.io/papeleo/planner/ACCESSIBILITY |
| `ACCEPTABLE_USE` | https://gabrielcatdeveloper.github.io/papeleo/planner/ACCEPTABLE_USE |
| `DMCA` | https://gabrielcatdeveloper.github.io/papeleo/planner/DMCA |
| `CONTACT` | https://gabrielcatdeveloper.github.io/papeleo/planner/CONTACT |

`THIRD_PARTY_LICENSES.md` **no** se publica: es un inventario interno y
la app lo muestra siempre desde su copia local, en un modal.

---

*Estos textos son modelos informativos, no sustituyen al
asesoramiento jurídico profesional.*
