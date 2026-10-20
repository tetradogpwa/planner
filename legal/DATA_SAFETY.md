# Google Play — Sección "Data Safety" (plantilla)

> Esta plantilla refleja exactamente las respuestas que el Desarrollador
> debería marcar en el formulario **Data Safety** del Google Play
> Console al subir el APK. Las respuestas deben coincidir con el
> comportamiento real de la app. Si cambias algo del código que afecte
> a tratamiento de datos, revisa este documento.

> ⚠️ **No distribuir** este archivo en la app. Es solo guía interna.

---

## A. ¿La app recoge o comparte datos del usuario?

**Respuesta corta:** No, por defecto. La app es gratuita, sin
anuncios, sin compras y 100 % local.

**Detalle por categoría (marca lo que corresponda):**

| Categoría | ¿Se recoge? | ¿Se comparte? | Notas |
|-----------|--------------|----------------|-------|
| Información de contacto (nombre, email, etc.) | ❌ no | ❌ no | La app no tiene formularios que lo pidan |
| Información financiera | ❌ no | ❌ no | No hay compras in-app en la versión actual |
| Salud y estado físico | ❌ no | ❌ no | Las tareas son personales |
| Mensajes | ❌ no | ❌ no | Sin chat |
| Fotos y vídeos | ❌ no | ❌ no | No se accede a cámara |
| Archivos de audio | ❌ no | ❌ no | Sin micrófono |
| Archivos y documentos | ❌ no | ❌ no | Solo JSON en disco local |
| Calendario | ❌ no | ❌ no | Solo calendario interno |
| Contactos | ❌ no | ❌ no | No se accede |
| Actividad en la app | ❌ no | ❌ no | Sin analítica |
| Información del dispositivo | ❌ no | ❌ no | Sin identificador de dispositivo |
| Identificadores de cuenta | ❌ no | ❌ no | No hay login |
| Ubicación | ❌ no | ❌ no | No se geolocaliza |

## B. ¿Todos los datos son tratados en el dispositivo?

**Sí.** Por defecto, **toda la información de la app vive en el
dispositivo del usuario**. El Desarrollador no recibe ninguna de las
categorías anteriores.

## C. ¿Qué ocurre cuando la versión muestra anuncios?

**No aplica.** La Aplicación no muestra anuncios. Esta sección se
rellenará si en el futuro el Desarrollador reactiva la monetización
(ver `docs/publicacion-comercial/README.md`).

## D. Compras in-app

**No aplica.** La Aplicación no ofrece compras in-app. Cuando se
reactive la monetización, esta sección se actualizará con el nombre
del producto y la persistencia local del flag correspondiente.

## E. ¿La app está dirigida a niños?

**No.** Marcar como "No, no está dirigida a niños".

## F. Cuenta de desarrollador y declaración de comerciante

En Google Play Console: declarar la cuenta como **"no comerciante"**
mientras la app siga siendo gratuita, sin anuncios y sin compras. Si
se reactiva la monetización, cambiar la declaración a comerciante y
volver a revisar este documento.

## G. Compromisos

El Desarrollador se compromete a:

1. Actualizar esta sección si cambia el código que afecte a datos.
2. Sincronizar la `PRIVACY.md` con esta sección.
3. No recoger ni compartir nuevas categorías sin avisar en el listado.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*
