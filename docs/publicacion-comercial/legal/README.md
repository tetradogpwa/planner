# Textos legales de Planificador Semanal

Esta carpeta contiene todos los textos legales del proyecto.

> ⚠️ **AVISO IMPORTANTE — MODELOS.**
> Todos los textos de esta carpeta son **modelos informativos**, no
> asesoramiento jurídico profesional. Antes de publicar la app en
> cualquier tienda o de activar la monetización con anuncios, el
> Desarrollador debería revisarlos con un abogado de su jurisdicción.
>
> Los campos marcados con `[…]` **deben rellenarse con datos reales**
> antes del primer release en producción.

---

## Inventario

| Archivo | Para qué sirve | Obligatorio en… |
|---------|----------------|-----------------|
| `PRIVACY.md` | Política de privacidad (RGPD, CCPA/CPRA, LGPD) | Google Play, Microsoft Store, web pública |
| `TERMS.md` | Términos generales de uso | Web pública |
| `EULA.md` | Contrato de licencia de usuario final | Microsoft Store (MSIX), opcional en Google Play |
| `COOKIES.md` | Política de cookies y consentimiento | Web pública, webview de escritorio |
| `DMCA.md` | Política de retirada de contenido | Microsoft Store |
| `REDS.md` (renombrar) → ver `REFUNDS.md` | Política de reembolsos y desistimiento | Google Play, Microsoft Store |
| `REFUNDS.md` | Política de reembolsos y desistimiento (UE) | Google Play, Microsoft Store |
| `ADS_DISCLOSURE.md` | Aviso publicitario específico (Google Ads) | Web pública, app, README de monetización |
| `ACCESSIBILITY.md` | Declaración de accesibilidad (WCAG 2.1 AA) | Web pública (UE), opcional en stores |
| `ACCEPTABLE_USE.md` | Política de uso aceptable y edad mínima | Google Play, Microsoft Store |
| `CONTACT.md` | Datos del responsable del tratamiento | Todos (especialmente para AEPD/LSSI) |
| `DATA_SAFETY.md` | Plantilla para el formulario Data Safety del Play Console | Google Play |
| `SOURCES_OF_FINES.md` | **Interno.** Checklist de fuentes de multas y riesgos | Repositorio (no se distribuye) |
| `THIRD_PARTY_LICENSES.md` | Inventario de licencias de terceros | Repositorio (no se distribuye) |
| `LICENSE` | Licencia de código fuente del Desarrollador | Repositorio |
| `STORE_POLICIES.md` | **Pendiente de crear.** Cumplimiento específico de cada tienda | Repositorio |

## Cómo usarlos

1. **Rellena los placeholders** `[…]` en cada archivo. Sugerencia:
   usar `grep -r "\[TU_" legal/` para localizarlos todos.
2. **Publica** las versiones `.md` en tu web como `.html`
   (cualquier static site renderer tipo GitHub Pages sirve).
3. **Configura** las direcciones en `CONTACT.md` (sección 5).
4. **Antes de cada release**, revisa `SOURCES_OF_FINES.md` (sección
   18 — checklist pre-release).

## Idiomas

Estos modelos están en **español**, alineados con la UI de la app.

Si publicas en mercados no hispanohablantes:

- Considera traducir al menos `PRIVACY.md`, `TERMS.md`, `COOKIES.md` y
  `EULA.md` al inglés y al idioma local del mercado objetivo.
- Las tiendas **no exigen** traducción a todos los idiomas, pero sí
  que el idioma por defecto esté disponible y sea el declarado en el
  listado de la tienda.

---

*Estos textos son modelos informativos, no sustituyen al
asesoramiento jurídico profesional.*