# Google Play — Sección "Data Safety" (plantilla)

> Esta plantilla refleja exactamente las respuestas que el Desarrollador
> debería marcar en el formulario **Data Safety** del Google Play
> Console al subir el APK. Las respuestas deben coincidir con el
> comportamiento real de la app. Si cambias algo del código que afecte
> a tratamiento de datos, revisa este documento.

> ⚠️ **No distribuir** este archivo en la app. Es solo guía interna.

---

## A. ¿La app recoge o comparte datos del usuario?

**Respuesta corta:** No, por defecto.

**Detalle por categoría (marca lo que corresponda):**

| Categoría | ¿Se recoge? | ¿Se comparte? | Notas |
|-----------|--------------|----------------|-------|
| Información de contacto (nombre, email, etc.) | ❌ no | ❌ no | La app no tiene formularios que lo pidan |
| Información financiera | ❌ no | ❌ no | Las compras in-app las gestiona la tienda |
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

## C. ¿Qué ocurre cuando la versión gratuita muestra anuncios?

En ese caso se carga **Google AdMob**, que sí recoge y trata datos.
Marca en el formulario:

- **Categoría:** "Actividad en la app" + "Información del dispositivo"
- **Recogida:** ✅ sí, pero por el **proveedor (Google)**; el
  Desarrollador no recibe los datos.
- **Compartida:** ✅ sí, con Google Ads como procesador.
- **¿Es opcional?** Sí — el usuario puede adquirir la versión sin
  anuncios.
- **¿Se puede desactivar?** Sí, mediante compra in-app o restableciendo
  el ID de publicidad en los ajustes del sistema.
- **Se usan para personalizar anuncios:** según la configuración del
  usuario en `adssettings.google.com` y en los ajustes del dispositivo.

## D. Compras in-app

- **Producto:** "Quitar anuncios" (suscripción o compra única,
  pendiente de decidir).
- **¿Se recoge información financiera?** No por el Desarrollador. El
  pago lo gestiona la tienda; Google Play emite un justificante firmado
  con el `purchaseToken` y el `orderId`. Esos campos no contienen PII.
- **Persistencia local:** la app guarda un flag `adsRemoved` en disco.
  Este dato es local y no sale del dispositivo.

## E. ¿La app está dirigida a niños?

**No.** Marcar como "No, no está dirigida a niños".

Aun así, si un usuario menor de 13 usa la app:

- La app no recoge datos propios del menor.
- Google AdMob aplica automáticamente restricciones para tráfico
  marcado como infantil por su propio sistema (TAG child-directed
  treatment). En el inventario no se solicita TAG.

## G. Compromisos

El Desarrollador se compromete a:

1. Actualizar esta sección si cambia el código que afecte a datos.
2. Sincronizar la `PRIVACY.md` con esta sección.
3. No recoger ni compartir nuevas categorías sin avisar en el listado.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*