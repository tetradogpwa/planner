# Política de Cookies y tecnologías similares

**Última actualización:** 16 de octubre de 2026

**Planificador Semanal** ("la Aplicación") no utiliza cookies de
seguimiento propias. Esta nota explica qué tecnologías usa la
Aplicación y por qué.

---

## 1. Cookies que utiliza la Aplicación

Por defecto, **la Aplicación no instala cookies en tu navegador o
WebView**, salvo las estrictamente necesarias para:

- Recordar si la barra lateral está contraída en escritorio.
- Recordar la fecha de inicio del planificador.
- Recordar tus tareas, hábitos y configuración.

Todas estas son **cookies / almacenamiento local de primera parte,
estrictamente necesarias** para que la Aplicación funcione, y **no se
usan para rastreo publicitario**.

## 2. Cookies de terceros

Si la versión gratuita con anuncios está activa, Google puede instalar
cookies o usar identificadores equivalentes para:

- Limitar la frecuencia de un anuncio.
- Medir impresiones y clics.
- Seleccionar anuncios según tus intereses, si Google Ads está
  configurado en modo personalizado.

Las cookies concretas y finalidades se describen en:

- [https://policies.google.com/technologies/cookies](https://policies.google.com/technologies/cookies)
- [https://policies.google.com/technologies/ads](https://policies.google.com/technologies/ads)

Si has adquirido la versión sin anuncios, la Aplicación **no cargará**
los scripts de Google Ads y, por tanto, no se instalarán cookies de
Google con motivo de la Aplicación.

## 3. Cómo controlar las cookies de Google Ads

Puedes gestionar la publicidad personalizada desde:

- [https://adssettings.google.com/](https://adssettings.google.com/)

También puedes bloquear cookies de forma general en la configuración de
tu navegador o sistema operativo.

## 4. Almacenamiento local (LocalStorage)

La Aplicación utiliza el almacenamiento local del navegador o WebView
para guardar:

- Tareas y hábitos.
- Fecha de inicio.
- Preferencia de barra lateral.
- Estado de la compra "sin anuncios" (si la realizas).

Estos datos **no abandonan tu dispositivo**. Borrarlos desde la
configuración de tu navegador o desde la sección "Ajustes › Datos" de
la Aplicación no afecta a otras personas.

## 5. Identificadores publicitarios en móvil (Android / iOS)

Si la versión gratuita está activa y la Aplicación está instalada como
APK en Android, Google AdMob puede usar el **ID de publicidad** del
sistema. Puedes restablecerlo o desactivarlo desde los ajustes de tu
dispositivo:

- Android: *Ajustes → Google → Anuncios*.
- iOS: *Ajustes → Privacidad → Publicidad de Apple*.

## 6. Cómo obtener y revocar el consentimiento (UE / UK)

Para cumplir con el RGPD y la LSSI-CE, la Aplicación muestra un
**banner de consentimiento** la primera vez que se abre, **antes** de
cargar cualquier script publicitario. El banner:

1. Informa de que, si se aceptan, se cargarán cookies de Google con
   fines publicitarios.
2. Ofrece tres opciones equivalentes:
   - **Aceptar**: carga Google Ads.
   - **Rechazar**: no carga scripts publicitarios; se muestra un
     placeholder.
   - **Configurar**: permite elegir entre publicidad personalizada o
     contextualizada.
3. Las opciones **Aceptar** y **Rechazar** están al mismo nivel de
   visibilidad y a un solo clic. **No hay "cookie walls"**: rechazar
   no impide usar la Aplicación.
4. La elección se guarda en `localStorage` con la clave
   `adsConsent=accept|reject|personalized|non_personalized` y puede
   cambiarse desde el menú "Configuración → Privacidad" en cualquier
   momento.
5. El consentimiento se vuelve a solicitar, como máximo, **una vez cada
   12 meses** o cuando cambien las cookies utilizadas.

## 7. Lista de cookies y almacenamiento local de la Aplicación

| Clave | Tipo | Finalidad | Caducidad | ¿Necesaria? |
|-------|------|-----------|-----------|--------------|
| `planner_sidebar_collapsed` | LocalStorage | Recordar estado de la barra lateral | Persistente | Sí |
| `Context_KEY_START_DATE` | LocalStorage | Fecha de inicio del planificador | Persistente | Sí |
| `Context_KEY_TASKS` | LocalStorage | Tareas y hábitos del usuario | Persistente | Sí |
| `adsConsent` | LocalStorage | Elección del usuario sobre anuncios | Persistente | Sí (gestión de consentimiento) |
| `adsRemoved` | LocalStorage | Marca de compra "sin anuncios" | Persistente | Sí |
| `GOOGLE_ADS_*` | Cookies de terceros | Personalización y medición de anuncios | Hasta 13 meses | No; solo si consientes |

## 8. Cambios en esta política

Cualquier cambio se reflejará aquí, con la fecha de "Última
actualización" actualizada. Si los cambios son materiales (por ejemplo,
se introduce una nueva red publicitaria), se volverá a mostrar el
banner de consentimiento.

---

*Este texto es un modelo y no sustituye al asesoramiento jurídico
profesional. El Desarrollador debería revisarlo con un abogado antes
de publicar la app en tiendas.*