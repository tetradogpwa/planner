# Declaración de accesibilidad

**Última actualización:** 16 de octubre de 2026

Planificador Semanal se compromete a hacer su aplicación utilizable
por el mayor número de personas posible, incluidas personas con
discapacidad. Esta declaración describe el estado de cumplimiento y
los canales para reportar barreras de accesibilidad.

---

## 1. Marco normativo

Esta declaración se publica en cumplimiento de:

- **Directiva (UE) 2019/882** — European Accessibility Act.
- **Real Decreto 1112/2018** (España), por el que se traspone la
  directiva anterior para productos y servicios digitales del sector
  privado.
- **WCAG 2.1 nivel AA** — estándar técnico de referencia.
- **EN 301 549** — requisitos de accesibilidad para productos y
  servicios TIC en Europa.

## 2. Estado de cumplimiento

| Requisito WCAG 2.1 AA | Estado | Notas |
|------------------------|--------|-------|
| 1.1.1 Contenido no textual (alternativas) | ✅ Cumplido | Iconos de la barra lateral llevan `aria-label` y texto alternativo |
| 1.3.1 Información y relaciones | ✅ Cumplido | La estructura usa HTML semántico (`nav`, `main`, `section`) y ARIA donde es necesario |
| 1.4.3 Contraste mínimo | ⚠️ Parcial | Tema claro y oscuro verifican contraste AA en la mayoría del texto; algunas etiquetas de estado pendientes |
| 1.4.4 Redimensionamiento de texto | ✅ Cumplido | El layout se adapta a `font-size` del navegador |
| 1.4.10 Reflow | ✅ Cumplido | Diseño responsive sin scroll horizontal a 320 CSS px |
| 1.4.11 Non-text contrast | ⚠️ Parcial | Pendiente revisar bordes de inputs en ambos temas |
| 2.1.1 Teclado | ✅ Cumplido | Todos los controles son accesibles con teclado; ver checklist pre-release |
| 2.1.2 Sin trampas de teclado | ✅ Cumplido | No hay foco atrapado |
| 2.4.3 Orden del foco | ✅ Cumplido | Sigue el orden visual |
| 2.4.6 Etiquetas y nombres | ✅ Cumplido | Todos los `input` tienen `<label>` o `aria-label` |
| 2.4.7 Foco visible | ✅ Cumplido | Foco con outline visible |
| 2.5.3 Etiqueta en el nombre | ✅ Cumplido | El nombre accesible coincide con el texto visible |
| 3.1.1 Idioma de la página | ✅ Cumplido | `<html lang="es">` |
| 3.2.1 Al recibir foco | ✅ Cumplido | No hay cambios de contexto al recibir foco |
| 3.2.2 Al cambiar configuración | ✅ Cumplido | Sin cambios automáticos de contexto |
| 3.3.1 Identificación de errores | ✅ Cumplido | Inputs con `aria-invalid` y mensaje de error |
| 3.3.2 Etiquetas o instrucciones | ✅ Cumplido | Cada input tiene su propósito claro |
| 4.1.2 Nombre, función, valor | ✅ Cumplido | Componentes personalizados exponen estado vía ARIA |

Estado general: **parcialmente conforme** con WCAG 2.1 AA. Las
carencias listadas están programadas para resolverse en próximas
versiones.

## 3. Limitaciones conocidas

- **Exportación a PDF:** el motor actual (`html2pdf.js`) genera un
  PDF que hereda la maquetación de la vista de impresión. La
  accesibilidad del PDF depende de las opciones que se pasen al
  motor; actualmente **no se embeben etiquetas de accesibilidad**.
- **Avisos publicitarios:** los anuncios servidos por Google están
  fuera del control del Desarrollador en cuanto a su accesibilidad.

## 4. Compatibilidad con tecnologías de asistencia

La Aplicación ha sido probada con:

- Lector de pantalla **NVDA** en Firefox/Chromium.
- Lector de pantalla **VoiceOver** en macOS.
- Navegación por teclado puro (Tab, Shift+Tab, Enter, Espacio, flechas).

La Aplicación **no requiere** lector de pantalla para su uso
principal, pero la combinación de teclado + lector de pantalla es
el método recomendado para usuarios con discapacidad visual.

## 5. Cómo reportar una barrera

Si encuentras una barrera de accesibilidad o quieres solicitar el
contenido en un formato alternativo, escríbenos a:

- **Correo:** `[TU_EMAIL_ACCESIBILIDAD]` (puede ser el mismo de
  contacto general).
- **Plazo de respuesta objetivo:** 5 días hábiles.

Por favor, incluye:

1. La página, vista o componente afectado.
2. La tecnología de asistencia que usas (lector de pantalla, tipo de
   teclado, magnificador, etc.).
3. El navegador o plataforma.
4. Una breve descripción del problema y, si es posible, pasos para
   reproducirlo.

## 6. Compromiso de mejora continua

El Desarrollador revisará esta declaración en cada release mayor y
publicará los avances en el repositorio del proyecto.

---

*Modelo informativo, no sustituye al asesoramiento jurídico profesional.*