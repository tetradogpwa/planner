# Fuentes de multas y otros riesgos legales — Revisión

**Fecha de la revisión:** 16 de octubre de 2026
**Aplicación auditada:** Planificador Semanal
**Distribuciones previstas:** APK (Android), AppImage (Linux), MSIX (Microsoft Store)
**Jurisdicciones objetivo:** Unión Europea (con foco en España) y California

Este documento es **interno** del repositorio. **No** se distribuye con la app;
sirve como checklist para que el Desarrollador verifique, antes de cada
release, que cumple con todas las fuentes de riesgo listadas.

> **Aviso importante:** Este análisis es informativo y no constituye
> asesoramiento jurídico. Antes de publicar la app en una tienda o de
> activar la monetización con anuncios, el Desarrollador debería revisar
> todos los textos legales con un abogado de su jurisdicción.

---

## 0. Estado de cumplimiento (a rellenar)

| Fuente de riesgo | Texto legal que lo cubre | Estado | Notas |
|------------------|--------------------------|--------|-------|
| GDPR | `PRIVACY.md`, `TERMS.md` | pendiente de revisión por abogado | |
| ePrivacy / cookies | `COOKIES.md`, `ADS_DISCLOSURE.md` | pendiente | |
| LOPDGDD / LSSI | `PRIVACY.md` § España, `TERMS.md` § España, `CONTACT.md` | pendiente | falta NIF y domicilio |
| CCPA / CPRA | `PRIVACY.md` § California, sección "Do Not Sell" | pendiente | |
| LGPD | `PRIVACY.md` § Brasil | pendiente | se referencia; no es objetivo principal |
| COPPA | `PRIVACY.md` § Menores, `ACCEPTABLE_USE.md` | pendiente | |
| UK Age-Appropriate Design | `PRIVACY.md` § Menores, `ACCEPTABLE_USE.md` | pendiente | UK no es objetivo principal |
| European Accessibility Act | `ACCESSIBILITY.md` | pendiente | |
| DMCA | `DMCA.md` | pendiente | |
| Google Play Policies | `DATA_SAFETY.md`, `PRIVACY.md` | pendiente | |
| Microsoft Store Policies | `PRIVACY.md`, `STORE_POLICIES.md` | pendiente | |
| Google AdMob/AdSense Policies | `ADS_DISCLOSURE.md`, `COOKIES.md` | pendiente | |
| IAP / derecho de desistimiento | `REFUNDS.md`, `TERMS.md` | pendiente | |
| Open source licenses | `LICENSES.md` (a crear) | pendiente | html2pdf.js = MIT (compatible) |
| Marca / naming | `DMCA.md` § 2 | pendiente | "Planificador Semanal" debe comprobarse libre |

---

## 1. GDPR — Reglamento (UE) 2016/679

**Texto legal afectado:** `PRIVACY.md`, `TERMS.md`, `COOKIES.md`

**Riesgo de sanción:** hasta el 4% de la facturación anual global del
año anterior o 20 M€, lo que sea mayor.

**Causas típicas de multa para esta app:**

1. No tener una política de privacidad accesible **antes** del primer
   tratamiento.
3. Cargar Google Ads sin base legal adecuada (interés legítimo mal
   calibrado) o sin permitir oposición.
4. No atender una solicitud de derechos ARCO-POL en plazo de 1 mes.
5. No firmar un DPA con proveedores que traten datos por cuenta del
   Desarrollador (Google Ads se rige por sus propias condiciones, pero
   debe documentarse).

**Mitigación aplicada en los textos:**

- Política con apartados por tema de tratamiento.
- Aviso explícito de que el Desarrollador no vende datos.
- Datos de contacto para ejercer derechos.
- Mención a la AEPD como autoridad de control en España.

**Pendiente:**

- Confirmar la identidad del Delegado de Protección de Datos (DPD/DPO):
  no es obligatorio en la mayoría de los casos para una app pequeña, pero
  hay que **dejarlo documentado** en `CONTACT.md`.
- Designar representante en la UE si el Desarrollador está fuera del EEE
  (no es el caso actual).

---

## 2. ePrivacy / "Ley de cookies" (Dir. 2002/58/CE + cada Estado miembro)

**Texto legal afectado:** `COOKIES.md`

**Riesgo de sanción:** en España, regulado por la LSSI-CE; sanciones de
hasta 150.000 € (infracción muy grave) por no informar u obtener
consentimiento.

**Causas típicas de multa para esta app:**

1. Cargar Google AdSense sin un banner de consentimiento que **bloquee**
   la carga hasta que el usuario acepte/rechace.
2. Considerar las cookies estrictamente necesarias como sujetas a
   consentimiento (no lo están, pero hay que **informar**).
3. No permitir rechazar de forma tan fácil como aceptar.

**Mitigación:** el aviso debe ser implementado en `index.html` /
`monetization.js` antes de cargar cualquier script publicitario.

**Pendiente:**

- Implementar banner de consentimiento real (no solo el texto) en el
  código. **Esto es código**, no un texto legal.

---

## 3. LOPDGDD + LSSI-CE (España)

**Texto legal afectado:** `PRIVACY.md`, `TERMS.md`, `CONTACT.md`

**Riesgo de sanción:**

- LOPDGDD: las del GDPR (reenvía).
- LSSI-CE: hasta 150.000 € (infracción muy grave).

**Causas típicas de multa para esta app:**

1. Falta de información al usuario sobre el responsable del sitio/app.
2. No incluir NIF/CIF y domicilio social en el aviso legal.

**Mitigación:** ver `CONTACT.md` con campos pendientes de rellenar.

**Pendiente:**

- Rellenar en `CONTACT.md`: nombre legal, NIF/CIF, domicilio, dirección
  de correo electrónico válida (no solo formulario).

---

## 4. CCPA / CPRA (California)

**Texto legal afectado:** `PRIVACY.md`

**Riesgo de sanción:** 2.500 $ por violación; $7.500 $ por violación
intencional o a menores.

**Causas típicas de multa para esta app:**

1. No incluir el enlace "Do Not Sell or Share My Personal Information"
   si Google Ads "comparte" datos con el Desarrollador en el sentido de
   la CPRA.
2. No respetar una solicitud de "Opt-Out of Sale/Sharing" en plazo de
   15 días hábiles.

**Mitigación:**

- El Desarrollador **no vende** datos del usuario: la app no recoge
  datos propios. Esa declaración está en `PRIVACY.md` § California.
- Aun así, el enlace debe existir porque **Google, como terceros, sí
  puede "compartir"** información según la CPRA.

**Pendiente:**

- Implementar el mecanismo "Do Not Sell" / "Do Not Share" en la app y
  en la página web. La acción debe desactivar los scripts
  publicitarios (el mismo flag que "adsRemoved").

---

## 5. LGPD (Brasil)

**Texto legal afectado:** `PRIVACY.md` § Brasil

**Riesgo de sanción:** hasta el 2% de los ingresos en Brasil o 50 M R$
por violación.

**Causas típicas de multa:** análogas a GDPR.

**Mitigación:** el Desarrollador **no recoge datos propios**. Solo se
menciona para que, si la app se promociona en Brasil, no parezca que la
aplicación ignora la ley.

**Pendiente:**

- Si en algún momento el público objetivo principal pasa a ser Brasil,
  traducir la política al portugués y designar representante local.

---

## 6. COPPA (Children's Online Privacy Protection Act, EE. UU.)

**Texto legal afectado:** `PRIVACY.md` § Menores, `ACCEPTABLE_USE.md`

**Riesgo de sanción:** hasta 50.120 $ por violación.

**Causas típicas de multa para esta app:**

1. Recoger datos de menores de 13 sin consentimiento parental
   verificable.

**Mitigación:**

- La app no recoge datos personales propios, así que el riesgo es
  residual.
- Se prohíbe en `ACCEPTABLE_USE.md` usar la app con menores de 13 si se
  van a introducir datos que Google Ads pueda asociar a un niño.

**Pendiente:**

- Definir edad mínima de uso (recomendado: 13 años).

---

## 7. UK Age-Appropriate Design Code (ICO)

**Texto legal afectado:** `PRIVACY.md` § Menores, `ACCEPTABLE_USE.md`

**Riesgo de sanción:** hasta el 4% de la facturación global.

**Causas típicas:** análogas a COPPA, pero también requisitos
adicionales (geolocalización por defecto off, profiling off por defecto,
etc.).

**Mitigación:** la app es local-first y no geolocaliza. Se documenta
en `ACCEPTABLE_USE.md`.

**Pendiente:** confirmar que el mercado objetivo principal no es UK.

---

## 8. European Accessibility Act (Dir. 2019/882)

**Texto legal afectado:** `ACCESSIBILITY.md`

**Riesgo de sanción:** variable por país; multa administrativa en cada
uno. En España, sanciones según la LISMI / RDL 1/2013.

**Causas típicas de multa:**

1. Software que se venda en la UE sin cumplir los requisitos de
   accesibilidad (WCAG 2.1 AA, EN 301 549).

**Mitigación:** se publica una declaración de accesibilidad con la
lista de incumplimientos conocidos y un canal de reporte.

**Pendiente:** revisar `index.css` y `ui/` para confirmar contraste,
navegación por teclado, ARIA labels.

---

## 9. DMCA (17 U.S.C. § 512)

**Texto legal afectado:** `DMCA.md`

**Riesgo de sanción:** retirada del contenido en Microsoft Store /
Google Play Store + demanda civil por daños.

**Mitigación:** se publica una política de retirada con el formato
estándar.

---

## 10. Google Play Store Policies

**Texto legal afectado:** `DATA_SAFETY.md`, `PRIVACY.md`,
`ACCEPTABLE_USE.md`

**Riesgo:** retirada de la app, baneo de la cuenta de desarrollador,
retención de pagos.

**Causas típicas de multa/retirada para esta app:**

1. La sección "Data Safety" del Play Console no coincide con la
   realidad.
2. La política de privacidad no es accesible desde el listado.
3. La app contiene anuncios que no respetan las políticas de AdMob
   (incentivados, etc.).
4. La app pide permisos no justificados.

**Mitigación:** `DATA_SAFETY.md` está rellenado con los valores
esperados para enviar al Play Console.

**Pendiente:**

- Confirmar que el `targetSdkVersion` cumple el mínimo exigido por
  Google Play cada temporada.

---

## 11. Microsoft Store Policies

**Texto legal afectado:** `PRIVACY.md`, `STORE_POLICIES.md`

**Riesgo:** retirada, baneo de cuenta.

**Causas típicas:**

1. Falta de URL de "Privacy statement" válida en el Partner Center.
2. La app declara funciones que no tiene, o no declara las que tiene.

**Mitigación:**

- `PRIVACY.md` debe estar accesible en una URL pública estable.
  **Recomendación:** publicarlo como `privacy.html` en la página web
  del Desarrollador, y enlazarlo desde `CONTACT.md`.

**Pendiente:**

- Crear la URL pública de la política de privacidad (alojada en el
  sitio del Desarrollador) y añadirla en `CONTACT.md`.

---

## 12. Google AdMob / AdSense Policies

**Texto legal afectado:** `ADS_DISCLOSURE.md`, `COOKIES.md`

**Riesgo:** baneo de cuenta de AdMob, retención de pagos,
responsabilidad compartida por infracciones graves.

**Causas típicas:**

1. Inducir clics (anuncios cerca de botones, "thanks for closing
   this ad", etc.).
2. Pagar a usuarios por ver anuncios.
3. Mezclar redes de anuncio no autorizadas.
4. Anuncios que se solapan con contenido o cubren navegación.

**Mitigación:**

- La app tiene un único punto de anuncio (banner discreto) lejos de
  botones primarios.
- `ADS_DISCLOSURE.md` deja por escrito que el Desarrollador sigue las
  reglas de Google.

**Pendiente:**

- Implementar banner de consentimiento real antes del primer AdSense.
- Validar tamaño y posición del banner contra las guías actuales de
  AdMob/AdSense.

---

## 13. Compras in-app y derecho de desistimiento (UE)

**Texto legal afectado:** `REFUNDS.md`, `TERMS.md`

**Riesgo de sanción:** hasta 10 M€ o 2% de facturación por
infracciones de la Dir. 2011/83/UE (Derechos de los Consumidores).

**Causas típicas para esta app:**

1. No informar del derecho de desistimiento de 14 días cuando la
   compra no es "contenido digital ejecutado" (la activación del
   beneficio **sí** es ejecución inmediata).
2. No reembolsar cuando proceda.

**Mitigación:** `REFUNDS.md` documenta que la activación del producto
digital se considera consentimiento de ejecución y **pierde el derecho
de desistimiento** una vez prestado.

**Pendiente:**

- Verificar las políticas de la tienda concreta: Google Play y
  Microsoft Store ya tienen sus propias reglas de reembolso, pero el
  Desarrollador debe saber cómo redirigir al usuario a esas reglas.

---

## 14. DSA / Digital Services Act (UE 2022/2065)

**Aplicabilidad:** una app **standalone** que no actúa como
"plataforma online" **probablemente NO entra en el ámbito del DSA**.
Se menciona para descartar.

**Mitigación:** nota en `TERMS.md`.

---

## 15. Open source licenses

**Texto legal afectado:** `LICENSES.md` (a crear si se decide),
`PRIVACY.md` § Software de terceros.

**Riesgo:** cierre de distribución si no se respetan licencias
(copyleft, atribución obligatoria, etc.).

**Inventario actual de dependencias:**

- **html2pdf.js** — MIT (compatible con distribución comercial).
- Código propio del Desarrollador — pendiente decidir licencia (recomendado: MIT para el frontend; ver `LICENSE`).

**Pendiente:**

- Crear `LICENSE` en la raíz.
- Crear `THIRD_PARTY_LICENSES.md` con todas las dependencias y sus
  licencias.

---

## 16. Marca / naming

**Texto legal afectado:** `DMCA.md` § 2

**Riesgo:** demanda por uso de marca ajena + cesación.

**Mitigación:**

- "Planificador Semanal" es genérico y descriptivo, pero conviene
  comprobar en la OEPM (España) y USPTO (EE. UU.) que no está
  registrado por terceros en clase 9 (software).
- Las menciones a "Google", "Android", "Microsoft", etc. se usan con
  fines descriptivos y de interoperabilidad.

---

## 17. Resumen ejecutivo

| Riesgo | Probabilidad | Impacto | Acción inmediata |
|--------|--------------|---------|------------------|
| GDPR incompleto | media | alto | Revisar `PRIVACY.md` con abogado |
| Cookies sin consentimiento | alta si Ads activos | medio-alto | Implementar banner de consentimiento |
| LSSI sin datos identificativos | alta | medio | Rellenar placeholders en `CONTACT.md` |
| CCPA sin enlace Do Not Sell | media si llega a CA | medio | Añadir enlace + flag en app |
| COPPA | baja | alto | Prohibir <13 en AUP |
| Google Play Data Safety mal | alta | alto | Usar `DATA_SAFETY.md` |
| AdMob infracciones | media | medio | Revisar `ADS_DISCLOSURE.md` y código |
| Accesibilidad | baja | baja-media | Publicar `ACCESSIBILITY.md` con lista de pendientes |
| Licencias OSS | baja | media | Crear `LICENSES.md` |

---

## 18. Checklist pre-release

Antes de cada subida a una tienda o distribución:

- [ ] Todos los textos legales están actualizados con la fecha del release.
- [ ] `CONTACT.md` tiene datos reales (no placeholders).
- [ ] `LICENSE` está en la raíz del repo.
- [ ] La URL pública de la política de privacidad está fijada y
      responde 200 OK.
- [ ] La sección "Data Safety" del Play Console coincide con
      `DATA_SAFETY.md`.
- [ ] La URL de "Privacy statement" del Partner Center (Microsoft)
      coincide con la política de privacidad pública.
- [ ] El banner de consentimiento de cookies está **activo** antes
      del primer `adsbygoogle` o `AdMob.load()`.
- [ ] El flag `adsRemoved` está marcado en la build "sin anuncios".
- [ ] El inventario de dependencias OSS y sus licencias está en
      `THIRD_PARTY_LICENSES.md`.

---

*Documento interno. No distribuir con la app.*
*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*