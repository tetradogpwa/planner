# Datos de contacto e información del responsable

> ⚠️ **PLANTILLA.** Todos los campos marcados con `[…]` deben rellenarse
> con datos reales antes de publicar la app. Mientras estén vacíos, los
> textos legales son inválidos para su uso en producción.

---

## 1. Responsable del tratamiento

| Campo | Valor |
|-------|-------|
| Nombre legal | `[TU_NOMBRE_LEGAL]` (ej. "Nombre Apellido Apellido" o "Razón social S.L.") |
| Nombre comercial | "Gabriel Cat Developer" |
| Marca del producto | "Planificador Semanal" |
| NIF / CIF / equivalente | `[TU_NIF_O_CIF]` |
| Domicilio fiscal | `[TU_DOMICILIO_COMPLETO]` |
| País de residencia | `[TU_PAIS]` |
| Correo de contacto | `[TU_EMAIL_CONTACTO]` |
| Sitio web | `[TU_URL_WEB]` |

## 2. Delegado de Protección de Datos (DPO)

Solo obligatorio si:

- el tratamiento es masivo y afecta a un gran número de personas,
- se tratan categorías especiales de datos a gran escala,
- se hace seguimiento sistemático a gran escala.

**Para esta app el DPO NO es obligatorio** (no se hacen perfiles a
gran escala; el Desarrollador no tiene empleados; los datos son locales).

Aun así, se designa un canal único para temas de privacidad:

- **Email de privacidad:** `[TU_EMAIL_PRIVACIDAD]` (puede ser el mismo
  que el de contacto)
- **Plazo de respuesta objetivo:** 7 días naturales (legal: 1 mes, ampliable
  a 2 meses si la solicitud es compleja).

## 3. Representante en el EEE / UK

Solo obligatorio si el responsable **no** está establecido en el EEE ni en
el Reino Unido. **No aplica** si resides en un Estado miembro.

## 4. Autoridades de control

- **España:** Agencia Española de Protección de Datos (AEPD) — `www.aepd.es`
- **Resto UE:** autoridad de control del país del usuario (lista en
  `edpb.europa.eu/about-edpb/about-edpb/members_es`).
- **California (EE. UU.):** California Privacy Protection Agency (CPPA) y
  Office of the Attorney General (calprivacy.oag.ca.gov).
- **Brasil:** Autoridade Nacional de Proteção de Dados (ANPD) — `www.gov.br/anpd`.

---

## 5. Direcciones públicas que necesitas mantener activas

Estos enlaces deben responder 200 OK y mantener la última versión de
los textos:

- `https://[TU_DOMINIO]/legal/privacy.html` → `legal/PRIVACY.md`
- `https://[TU_DOMINIO]/legal/terms.html` → `legal/TERMS.md`
- `https://[TU_DOMINIO]/legal/eula.html` → `legal/EULA.md`
- `https://[TU_DOMINIO]/legal/cookies.html` → `legal/COOKIES.md`
- `https://[TU_DOMINIO]/legal/refunds.html` → `legal/REFUNDS.md`
- `https://[TU_DOMINIO]/legal/accessibility.html` → `legal/ACCESSIBILITY.md`
- `https://[TU_DOMINIO]/legal/contact.html` → este archivo

> **Consejo:** configura un redirect desde cada `.html` al `.md`
> correspondiente en tu CDN (Cloudflare Pages, GitHub Pages, Netlify) y
> deja que GitHub Pages renderice el Markdown automáticamente.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*