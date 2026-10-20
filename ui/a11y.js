// ────────────────────────────────────────────────────────────────────
// ui/a11y.js
//
// Utilidades de accesibilidad compartidas por las vistas y por los
// diálogos modales. Cubre:
//   - Detección de campos editables (para no disparar atajos globales).
//   - Trampa de foco (Tab / Shift+Tab) dentro de un contenedor, con
//     referencia al elemento que abrió el diálogo para devolver el foco
//     al cerrar.
//   - Navegación por teclado en menús (Flechas, Inicio/Fin) y en
//     listas tablist (patrón ARIA Authoring Practices).
//   - `focusHeading(section)`: al cambiar de vista, mueve el foco al
//     primer encabezado (h1/h2/h3) de la sección activa con
//     `tabindex="-1"`.
// ────────────────────────────────────────────────────────────────────

/** Elementos donde escribiría el usuario y en los que NO se deben
 *  disparar los atajos globales. Excluimos los botones y enlaces
 *  intencionalmente: aunque con `?` se abriría la ayuda de atajos
 *  desde un `<button>`, eso es lo deseado (el usuario acaba de
 *  tabular a un control, soltó el teclado y pulsa `?`). */
export function isEditable(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'SELECT')   return true;
  if (tag === 'INPUT') {
    const type = (target.type || 'text').toLowerCase();
    // 'button', 'submit', 'reset', 'checkbox', 'radio', 'file' se
    // consideran controles, no campos de escritura.
    const editableTypes = new Set([
      'text', 'search', 'email', 'url', 'tel', 'password',
      'number', 'date', 'time', 'datetime-local', 'month', 'week',
      'color',
    ]);
    return editableTypes.has(type);
  }
  if (target.isContentEditable) return true;
  return false;
}

/** Traba el foco dentro de `container` hasta que se llama a
 *  `release()`. Mientras está activa:
 *    - Primer foco automático al primer elemento enfocable.
 *    - Tab y Shift+Tab ciclan entre el primer y el último.
 *    - Escape llama a `onEscape()` si se pasa.
 *  Devuelve `release()`, una función que restaura el comportamiento
 *  por defecto y devuelve el foco al `previouslyFocused` que se le
 *  pase al abrirla (o al `document.activeElement` en ese momento). */
export function trapFocus(container, { onEscape } = {}) {
  if (!container) return () => {};

  const previouslyFocused = document.activeElement;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const getFocusable = () =>
    Array.from(container.querySelectorAll(focusableSelector))
      .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

  // Foco inicial.
  const firstFocus = getFocusable()[0] || container;
  if (firstFocus && typeof firstFocus.focus === 'function') firstFocus.focus();

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (onEscape) { e.preventDefault(); onEscape(); }
      return;
    }
    // En pruebas E2E bajo tauri-driver + WebKit, las teclas se
    // entregan como `e.key === 'Unidentified'` con `e.code === 'Tab'`,
    // por eso aceptamos también la detección por `code`.
    const isTab = e.key === 'Tab' || e.code === 'Tab';
    if (!isTab) return;
    const items = getFocusable();
    if (items.length === 0) { e.preventDefault(); return; }
    const first = items[0];
    const last  = items[items.length - 1];
    const active = document.activeElement;
    // El foco es "trappable" si está en uno de los elementos
    // enfocables del diálogo. No basta con que esté dentro: al abrir,
    // el foco puede haber ido al propio contenedor (p. ej.
    // `.shortcuts-content` con tabindex=-1) o al título del modal
    // (`#legal-modal-title`, también tabindex=-1), que no están en
    // `items`. Si dejamos pasar Tab ahí, el navegador lo lleva fuera.
    const inList = active && items.includes(active);
    if (e.shiftKey) {
      if (!inList || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (!inList || active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener('keydown', onKeyDown);

  return function release() {
    container.removeEventListener('keydown', onKeyDown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}

/** Marca el botón como parte de un widget tipo "menú" / "tablist":
 *  Flecha arriba/abajo o izquierda/derecha (configurable) mueven el
 *  foco entre los hermanos; Inicio/Fin van al primero/último. Home/End.
 *  Llamar una vez por teclado. El cambio de selección/activación lo
 *  gestiona cada vista (con su callback `onSelect` opcional). */
export function bindRovingTabindex(container, {
  selector = '[role="menuitem"], button, [tabindex]',
  orientation = 'vertical',   // 'vertical' | 'horizontal' | 'both'
  onSelect,
} = {}) {
  const items = () => Array.from(container.querySelectorAll(selector))
    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

  function setActive(idx) {
    const list = items();
    if (!list.length) return;
    const next = list[Math.max(0, Math.min(idx, list.length - 1))];
    list.forEach(el => el.setAttribute('tabindex', '-1'));
    next.setAttribute('tabindex', '0');
    next.focus();
  }

  function onKeyDown(e) {
    const list = items();
    if (!list.length) return;
    const idx = list.indexOf(document.activeElement);
    if (idx < 0) return;

    const prevKey   = orientation === 'horizontal' ? 'ArrowLeft'  : 'ArrowUp';
    const nextKey   = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevOther = orientation === 'horizontal' ? 'ArrowUp'    : 'ArrowLeft';
    const nextOther = orientation === 'horizontal' ? 'ArrowDown'  : 'ArrowRight';

    let handled = false;
    switch (e.key) {
      case prevKey:
        setActive((idx - 1 + list.length) % list.length); handled = true; break;
      case nextKey:
        setActive((idx + 1) % list.length); handled = true; break;
      case 'Home':
        setActive(0); handled = true; break;
      case 'End':
        setActive(list.length - 1); handled = true; break;
      default:
        // En orientación 'both' también aceptamos la perpendicular.
        if (orientation === 'both') {
          if (e.key === prevOther) {
            setActive((idx - 1 + list.length) % list.length); handled = true;
          } else if (e.key === nextOther) {
            setActive((idx + 1) % list.length); handled = true;
          }
        }
    }
    if (handled) { e.preventDefault(); return; }

    if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSelect(document.activeElement, e);
    }
  }

  container.addEventListener('keydown', onKeyDown);
}

/** Mueve el foco al primer encabezado (h1/h2/h3) de `section`. Le
 *  pone `tabindex="-1"` para que sea enfocable por script aunque no
 *  sea interactivo. Si no hay encabezado, el foco se queda como esté:
 *  el `main` ya tiene `tabindex="-1"` puesto desde index.html. */
export function focusHeading(section) {
  if (!section) return;
  const heading = section.querySelector('h1, h2, h3');
  const target  = heading || section;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: false });
}
