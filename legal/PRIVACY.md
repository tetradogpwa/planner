# Política de Privacidad

**Última actualización:** 16 de octubre de 2026

**Planificador Semanal** (en adelante, "la Aplicación") es una aplicación
desarrollada por **Gabriel Cat Developer** (en adelante, "el Desarrollador")
que funciona como planificador local de hábitos y tareas.

Esta política describe qué datos trata la Aplicación y por qué. La Aplicación
está diseñada para funcionar, por defecto, **sin recopilación de datos
personales**.

---

## 1. Datos que NO se recopilan por defecto

La Aplicación está diseñada para ser utilizada sin enviar datos personales a
ningún servidor. Concretamente:

- Las tareas, hábitos, fechas y configuraciones se guardan **únicamente en el
  dispositivo del usuario** mediante el almacenamiento local del sistema
  (LocalStorage en navegadores Web; en las aplicaciones Tauri nativas se
  utiliza el sistema de archivos del usuario gestionado por Tauri).
- La Aplicación **no envía tareas, nombres, descripciones, fechas ni
  configuraciones** a ningún servidor propio o de terceros cuando no se han
  habilitado los anuncios.
- La Aplicación **no crea perfiles de usuario**, **no asigna
  identificadores publicitarios propios** y **no comparte el contenido del
  planificador** con terceros.

---

## 2. Datos que se tratan cuando hay anuncios activos

Si el usuario no ha adquirido la versión sin anuncios, la Aplicación muestra
anuncios servidos por Google. En ese caso:

- Se cargan scripts publicitarios de Google (**AdSense** en escritorio/web y
  **AdMob** en Android) cuando se muestran las zonas publicitarias.
- Google puede tratar datos como los descritos en el apartado "Datos que
  Google trata" de su propia política:
  [https://policies.google.com/technologies/partner-sites](https://policies.google.com/technologies/partner-sites)
- Esos datos los trata Google como responsable del tratamiento, no el
  Desarrollador.
- El Desarrollador **no recibe** información personal identificable desde
  los anuncios; Google únicamente proporciona métricas agregadas
  (impresiones, país aproximado).

Si quieres dejar de ver anuncios, consulta la sección "Cómo quitar los
anuncios" más abajo.

---

## 3. Datos que se tratan cuando se realizan compras dentro de la app

Cuando el usuario adquiere la versión sin anuncios (u otra compra in-app
habilitada en el futuro):

- El pago es gestionado por la tienda correspondiente (Google Play Store en
  Android, Microsoft Store en Windows, App Store en iOS si llegase a
  publicarse allí).
- El Desarrollador recibe únicamente de la tienda: el identificador opaco
  del producto, la fecha de la compra y un justificante firmado por la
  tienda. **No** recibe nombre, correo, método de pago ni datos bancarios.
- En el dispositivo se guarda localmente un flag persistente que indica
  que la compra está activa, para no volver a mostrar anuncios.

---

## 4. Permisos del dispositivo

La Aplicación puede solicitar, dependiendo de la plataforma:

- **Almacenamiento local** (siempre): necesario para guardar tareas,
  hábitos y configuración.
- **Acceso a Internet** (solo si hay anuncios activos o actualizaciones
  opcionales): necesario para mostrar anuncios y, en su caso, comprobar
  actualizaciones.

La Aplicación **no solicita**: cámara, micrófono, ubicación, contactos,
calendario del sistema, sensores biométricos, ni ningún permiso sensible.

---

## 5. Copias de seguridad y portabilidad

- Toda la información del usuario se guarda en formato JSON dentro del
  almacenamiento local.
- El usuario puede **exportar** una copia de seguridad en JSON desde la
  sección "Ajustes › Datos → Exportar JSON".
- El usuario puede **importar** un JSON previamente exportado desde la
  misma sección.
- Los JSON exportados **no salen del dispositivo** a menos que el propio
  usuario los comparta por sus propios medios.

---

## 6. Menores de edad

La Aplicación está pensada para uso general y **no está dirigida a
menores de 13 años**. Se prohíbe expresamente el uso por menores de
13 años si la versión con anuncios está activa. Para más detalles,
consulta `ACCEPTABLE_USE.md`.

Si los anuncios de Google están activos, Google puede limitar la
personalización de anuncios cuando el usuario declara ser menor en su
cuenta, según la propia política de Google. El Desarrollador no recoge
edad de los usuarios.

Para Reino Unido, el Desarrollador respeta el *Age-Appropriate Design
Code* de la ICO: por defecto la app no perfila al usuario, no
geolocaliza, no comparte datos con terceros salvo los anuncios de
Google (que pueden activarse o desactivarse), y no retiene más datos
de los estrictamente necesarios.

## 6bis. Derechos del usuario en la Unión Europea (GDPR)

Si resides en la UE, tienes los siguientes derechos:

1. **Acceso** — solicitar qué datos trata el Desarrollador (por
   defecto: ninguno).
2. **Rectificación** — corregir datos inexactos.
3. **Supresión** ("derecho al olvido") — solicitar el borrado de tus
   datos.
4. **Limitación** — pedir que el tratamiento se limite en casos
   concretos.
5. **Portabilidad** — recibir tus datos en un formato estructurado y
   de uso común (ya disponible mediante `Exportar JSON`).
6. **Oposición** — oponerte al tratamiento basado en interés legítimo
   (en este caso, los anuncios de Google).
7. **No ser objeto de decisiones automatizadas** — la app no toma
   decisiones automatizadas sobre ti.

Para ejercerlos, escribe a `[TU_EMAIL_PRIVACIDAD]`. Plazo legal de
respuesta: **1 mes**, ampliable a 2 meses si la solicitud es compleja
(te avisaremos en ese caso). Si no quedas satisfecho, puedes reclamar
ante la **AEPD** (España) o la autoridad de control de tu país
(listadas en `CONTACT.md`).

## 6ter. Derechos del usuario en California (CCPA / CPRA)

Si resides en California, tienes los siguientes derechos:

1. **Derecho a saber** qué datos recoge o comparte la app.
2. **Derecho a borrar** los datos personales que la app trata sobre ti.
3. **Derecho a corregir** datos inexactos.
4. **Derecho a optar por no participar en la venta o el intercambio**
   (*Do Not Sell or Share My Personal Information*).
5. **Derecho a limitar el uso de información personal sensible**.
6. **No discriminación** por ejercer cualquiera de estos derechos.

**Confirmación importante:** El Desarrollador **no vende ni comparte**
información personal identificable del usuario con fines comerciales.
Los datos personales que llegan a terceros lo hacen únicamente a través
de Google AdSense/AdMob cuando la versión gratuita está activa, y
Google los trata como responsable independiente según su propia
política.

Para ejercer el derecho "Do Not Sell or Share", puedes:

- Adquirir la versión sin anuncios (recomendado: la app deja de cargar
  Google Ads por completo).
- O seguir el enlace
  **[Do Not Sell or Share My Personal Information](#)** que el
  Desarrollador publicará en la app y en la página web. Activar este
  enlace fija el flag local `adsRemoved=true` y bloquea los scripts
  publicitarios de Google.

Para consultas específicas sobre derechos CCPA/CPRA, escribe a
`[TU_EMAIL_PRIVACIDAD]`.

## 6 quater. Derechos del usuario en Brasil (LGPD)

Si resides en Brasil, te asisten los derechos análogos del RGPD
(acceso, rectificación, supresión, portabilidad, oposición). Puedes
ejercerlos escribiendo a `[TU_EMAIL_PRIVACIDAD]`. La autoridad de
control es la **ANPD** (`gov.br/anpd`).

## 6 quinquies. Accesibilidad

El Desarrollador publica una **declaración de accesibilidad** con el
estado de cumplimiento WCAG 2.1 AA en `ACCESSIBILITY.md`. Si encuentras
una barrera, repórtala por los canales indicados en ese documento.

## 6 sexies. Ley aplicable (España / LSSI-CE)

En cumplimiento de la **Ley 34/2002, de 11 de julio, de Servicios de la
Sociedad de la Información y de Comercio Electrónico (LSSI-CE)**, el
responsable del servicio se identifica en `CONTACT.md`.

El Desarrollador se reserva el derecho de suspender el acceso a
usuarios que incumplan la ley o los términos de la Aplicación.

---

## 7. Cómo quitar los anuncios

El usuario puede quitar los anuncios en cualquier momento adquiriendo la
"versión sin anuncios" dentro de la propia aplicación. Una vez
adquirida:

- No se cargarán scripts publicitarios.
- El flag "adsRemoved" se guarda localmente y se persiste al reinstalar
  la app si se restaura la copia de seguridad del sistema.

---

## 8. Cambios en esta política

El Desarrollador puede actualizar esta política para reflejar cambios en
la Aplicación o requisitos legales. Se cambiará el plazo "Última
actualización" y se conservará un historial en el repositorio del
proyecto. Si los cambios son materiales, se mostrará un aviso dentro de
la Aplicación.

---

## 9. Contacto

Para cualquier duda sobre privacidad, el usuario puede escribir a la
dirección de contacto indicada en la página del Desarrollador del
proyecto (ver `legal/CONTACT.md`).

---

## 10. Base legal (RGPD / UK GDPR)

Cuando es aplicable el Reglamento (UE) 2016/679 (RGPD), la base legal
para los tratamientos descritos es:

- **Almacenamiento local de tareas:** ejecución del contrato (la
  Aplicación necesita guardar datos para funcionar).
- **Mostrar anuncios de Google:** interés legítimo del Desarrollador en
  financiar el mantenimiento de la Aplicación, limitado al usuario que
  no ha adquirido la versión sin anuncios. El usuario puede oponerse en
  cualquier momento adquiriendo la versión sin anuncios.
- **Procesar compras:** ejecución del contrato entre el usuario y la
  tienda.

El Desarrollador **no realiza transferencias internacionales de datos**
propias. Las transferencias que se produzcan son las que Google realiza
como encargado/responsable independiente, según su propia política.

---

## 9. Control por asistente (servidor MCP local)

La Aplicación incluye, opcionalmente, un servidor local compatible con
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) para
que un asistente de IA pueda leer y modificar el plan desde
`127.0.0.1`. Este servidor:

- Está **desactivado por defecto** y solo escucha en `127.0.0.1`
  (no es accesible desde Internet ni desde otros dispositivos de la
  red local).
- Si se activa, exige un **token Bearer** aleatorio de 64 caracteres
  generado por la propia Aplicación. La Aplicación no envía ese token
  a ningún servidor externo.
- No abre ningún puerto en Android (la función no está disponible
  en esa plataforma).

**Importante: el Desarrollador no recibe los datos que el asistente
lea.** El servidor MCP de la Aplicación es solo un puente local:
lo que el asistente haga con esos datos depende del proveedor del
asistente (p. ej. Claude de Anthropic, otros modelos), no del
Desarrollador. Cuando el usuario pide a su asistente «qué tengo esta
semana» o «añade esta tarea», el contenido del plan **sale del
dispositivo hacia el proveedor del asistente** como parte del diálogo
con ese asistente. Ese proveedor lo trata según su propia política de
privacidad ([https://www.anthropic.com/privacy](https://www.anthropic.com/privacy)
en el caso de Anthropic), no la del Desarrollador. El Desarrollador
no tiene acceso a esos datos, ni siquiera de forma agregada.

**El token es personal y da acceso total al plan.** Quien conozca el
token puede leer, modificar y borrar todas las tareas y la fecha de
inicio. **No lo compartas**, igual que no compartirías la contraseña de
un servicio. Si sospechas que se ha filtrado, regenera el token desde
**Ajustes › Asistente (MCP)**: el token viejo deja de
funcionar en el siguiente request.

El usuario puede desactivar el servidor en cualquier momento desde
**Ajustes › Asistente (MCP)**. Mientras esté
desactivado, el puerto está cerrado y ninguna herramienta del
asistente puede hablar con la Aplicación.

---

*Este texto es un modelo y no sustituye al asesoramiento jurídico
profesional. El Desarrollador debería revisarlo con un abogado antes
de publicar la app en tiendas.*