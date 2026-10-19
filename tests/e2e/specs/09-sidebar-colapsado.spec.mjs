// Recorrido del menú lateral contraído en escritorio con ratón
// (Xvfb con WebKitGTK, que reporta hover: hover y pointer: fine).
//
// El criterio de T-010 es que, en ese entorno, el botón del menú
// contraído tenga el mismo tamaño que el del expandido: el icono
// pasa de 64 px (configurado en :root) al tamaño del icono
// expandido (1.4em sobre calc(1.1rem * var(--fs-nav))) y el
// padding del item vuelve al 0.7rem. Aquí se mide con
// getBoundingClientRect y se exige diferencia ≤ 1 px. El ancho
// del sidebar se reduce exactamente al icono + 1.5rem (padding
// horizontal del .nav-item) + 1rem (padding del .sidebar-nav).

import { aceptarTerminos } from '../helpers.mjs';

describe('Menú lateral contraído en escritorio', () => {
  before(async () => {
    await aceptarTerminos();
  });

  /** Mide el icono del primer .nav-item y devuelve alto, ancho y
   *  font-size calculado en píxeles. */
  const sizes = () => browser.execute(() => {
    const item = document.querySelector('button.nav-item[data-view="tasks"]');
    const icon = item.querySelector('.nav-icon');
    const itemRect = item.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      itemH: itemRect.height, itemW: itemRect.width,
      iconH: iconRect.height, iconW: iconRect.width,
      iconFontPx: parseFloat(getComputedStyle(icon).fontSize),
    };
  });

  /** Colapsa el menú y espera a que termine la transición CSS
   *  (ancho nuevo < 80 px y estable durante dos lecturas). */
  const colapsar = async () => {
    await $('#sidebarCollapseBtn').click();
    await browser.waitUntil(
      async () => (await $('#sidebar').getAttribute('class')).includes('collapsed'),
      { timeout: 1000, timeoutMsg: 'El menú no se ha contraído' },
    );
    // Espera a que la transición de `width 0.25s` termine: primero baja
    // de 200 px (comprobación rápida) y luego se mantiene estable por
    // debajo de 80 px (tamaño esperado en escritorio con ratón). Sin
    // esto, las medidas pueden caer a mitad de la transición.
    await browser.waitUntil(
      async () => {
        const w = await browser.execute(
          () => document.getElementById('sidebar').getBoundingClientRect().width,
        );
        return w < 80;
      },
      { timeout: 1500, timeoutMsg: 'El sidebar no se ha estrechado (transición CSS sin terminar)' },
    );
  };

  it('el icono del menú contraído mide lo mismo que el expandido', async () => {
    const expandido = await sizes();
    await colapsar();
    const contraido = await sizes();
    // Alto y ancho del icono contraído iguales al expandido (≤ 1 px
    // para tolerar subpíxeles del border-radius/transform).
    expect(Math.abs(contraido.iconH - expandido.iconH)).toBeLessThanOrEqual(1);
    expect(Math.abs(contraido.iconW - expandido.iconW)).toBeLessThanOrEqual(1);
    // font-size calculado idéntico: criterio "letra igual que expandido".
    expect(Math.abs(contraido.iconFontPx - expandido.iconFontPx)).toBeLessThanOrEqual(0.5);
    // Alto del botón también coincide (mismo padding 0.7rem).
    expect(Math.abs(contraido.itemH - expandido.itemH)).toBeLessThanOrEqual(1);
  });

  it('el ancho del sidebar contraído ≈ icono + 1.5rem + 1rem (±1 px)', async () => {
    // Espera a que termine la transición CSS de `width 0.25s` antes de
    // medir: si pillamos la barra a mitad, el ancho queda entre el
    // expandido (224 px) y el contraído (64 px) y la prueba falla.
    // Comparamos dos lecturas del rectWidth con un pequeño delay; si
    // coinciden la barra ya no se está moviendo.
    await browser.waitUntil(
      async () => {
        const w = await browser.execute(async () => {
          const sb = document.getElementById('sidebar');
          const a = sb.getBoundingClientRect().width;
          await new Promise(r => setTimeout(r, 50));
          const b = sb.getBoundingClientRect().width;
          return Math.abs(a - b) < 0.5 ? a : 0;
        });
        // El valor final esperado es ~64.6 px (icono + paddings) +
        // 1 px de border-right. Pedimos < 80 px y estable.
        return w > 0 && w < 80;
      },
      { timeout: 2000, timeoutMsg: 'El sidebar no terminó la transición al contraerse' },
    );
    const m = await browser.execute(() => {
      const sidebar = document.getElementById('sidebar');
      const icon = document.querySelector('button.nav-item[data-view="tasks"] .nav-icon');
      const sw = sidebar.getBoundingClientRect().width;
      const iw = icon.getBoundingClientRect().width;
      // 1 rem en píxeles de la raíz (100 % por defecto → 16 px).
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const csSB = getComputedStyle(sidebar);
      return {
        sw, iw, rem,
        sbBorderR: csSB.borderRightWidth,
      };
    });
    // Criterio: --sidebar-w-collapsed = iconW + 1.5rem + 1rem
    // (icono + 2 × 0.75rem del .nav-item + 2 × 0.5rem del .sidebar-nav).
    // Sumamos el border-right del .sidebar, que se incluye en
    // getBoundingClientRect().width del sidebar pero no en el cálculo
    // de --sidebar-w-collapsed.
    const esperado = m.iw + 1.5 * m.rem + 1 * m.rem + parseFloat(m.sbBorderR);
    expect(Math.abs(m.sw - esperado)).toBeLessThanOrEqual(1);
  });

  it('el icono no se recorta por ningún lado dentro del sidebar contraído', async () => {
    const m = await browser.execute(() => {
      const sidebar = document.getElementById('sidebar');
      const item = document.querySelector('button.nav-item[data-view="tasks"]');
      const icon = item.querySelector('.nav-icon');
      const sx = sidebar.getBoundingClientRect().left;
      const sw = sidebar.getBoundingClientRect().width;
      const ix = icon.getBoundingClientRect().left;
      const iw = icon.getBoundingClientRect().width;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return { iconLeftRel: ix - sx, iconRightRel: sw - (ix - sx) - iw, rem };
    });
    // El icono lleva un margen razonable a cada lado (≥ 4 px ≈ 0.25 rem)
    // para que no se recorte ni choque con la barra activa (3 px a la
    // izquierda) ni con el anillo de foco (offset 2 px).
    const minMargin = Math.max(4, 0.25 * m.rem);
    expect(m.iconLeftRel).toBeGreaterThanOrEqual(minMargin);
    expect(m.iconRightRel).toBeGreaterThanOrEqual(minMargin);
  });

  it('.content usa el mismo margen izquierdo que el ancho del sidebar contraído', async () => {
    const m = await browser.execute(() => {
      const sidebar = document.getElementById('sidebar');
      const content = document.querySelector('.content');
      return {
        sidebarW: sidebar.getBoundingClientRect().width,
        contentML: parseFloat(getComputedStyle(content).marginLeft),
      };
    });
    // Tolerancia de medio px por subpíxeles.
    expect(Math.abs(m.contentML - m.sidebarW)).toBeLessThanOrEqual(0.5);
  });

  it('con --fs-nav al 200 % el menú contraído crece en proporción y no recorta el icono', async () => {
    // Los tests anteriores han dejado el menú contraído. Si se da el
    // caso de que esté expandido (p. ej. este spec se ejecuta aislado
    // con --spec), primero lo colapsamos.
    const estabaColapsado = await browser.execute(
      () => document.getElementById('sidebar').classList.contains('collapsed'),
    );
    if (!estabaColapsado) await colapsar();

    // Fuerza el factor de tamaño del menú al 200 % (lo que hace la
    // preferencia Tamaño por partes → nav). Restauramos siempre.
    await browser.execute(() => {
      document.documentElement.style.setProperty('--fs-nav', '2');
    });
    try {
      // Espera a que termine la transición CSS de `width 0.25s` tras
      // cambiar --fs-nav: si medimos a mitad, el sidebar aún no llega
      // al nuevo ancho y la prueba falla por un par de píxeles. Para
      // confirmar estabilidad hacemos dos measurements separadas.
      await browser.waitUntil(
        async () => {
          const w = await browser.execute(async () => {
            const sb = document.getElementById('sidebar');
            const a = sb.getBoundingClientRect().width;
            await new Promise(r => setTimeout(r, 80));
            const b = sb.getBoundingClientRect().width;
            return Math.abs(a - b) < 0.5 ? a : 0;
        });
        // A fs-nav=2 esperamos ~89 px (icono + 1.5rem + 1rem + 1 borde).
        return w > 85;
      },
      { timeout: 2000, timeoutMsg: 'El sidebar no terminó la transición al crecer con --fs-nav=2' },
      );
      // Doble lectura tras la transición: confirma que el ancho es
      // estable (no sigue creciendo). Algunos navegadores webkit pueden
      // dejar la transición a medias si la media query cambia a la vez.
      await browser.pause(60);
      const m = await browser.execute(() => {
        const sidebar = document.getElementById('sidebar');
        const item = document.querySelector('button.nav-item[data-view="tasks"]');
        const icon = item.querySelector('.nav-icon');
        const sw = sidebar.getBoundingClientRect().width;
        const itemRect = item.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();
        const sx = sidebar.getBoundingClientRect().left;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const csSB = getComputedStyle(sidebar);
        return {
          sw, itemH: itemRect.height, iconH: iconRect.height,
          iconW: iconRect.width,
          iconLeftRel: iconRect.left - sx, rem,
          sbBorderR: csSB.borderRightWidth,
        };
      });
      // Fórmula esperada con fs-nav=2: icono + 1.5rem + 1rem +
      // border-right del sidebar. Mismo criterio que el test anterior,
      // aplicado ahora con el factor de tamaño al 200 %.
      const esperadoW = m.iconW + 1.5 * m.rem + 1 * m.rem + parseFloat(m.sbBorderR);
      expect(Math.abs(m.sw - esperadoW)).toBeLessThanOrEqual(1);
      // El alto del botón (que ahora es ~2× por la letra) también
      // crece, y el icono sigue cabiendo con margen a cada lado.
      expect(m.itemH).toBeGreaterThan(40);
      expect(m.iconLeftRel).toBeGreaterThanOrEqual(4);
      expect(m.sw - m.iconLeftRel - m.iconW).toBeGreaterThanOrEqual(4);
    } finally {
      // Restaura para no contaminar los tests siguientes.
      await browser.execute(() => {
        document.documentElement.style.removeProperty('--fs-nav');
      });
    }
  });

  it('al volver a expandir el menú, el ancho del sidebar vuelve al expandido', async () => {
    await $('#sidebarCollapseBtn').click();
    await browser.waitUntil(
      async () => !(await $('#sidebar').getAttribute('class')).includes('collapsed'),
      { timeout: 1500, timeoutMsg: 'El menú no se ha vuelto a expandir' },
    );
    await browser.waitUntil(
      async () => {
        const w = await browser.execute(
          () => document.getElementById('sidebar').getBoundingClientRect().width,
        );
        return w >= 220;
      },
      { timeout: 2500, timeoutMsg: 'El sidebar no ha vuelto al ancho expandido' },
    );
    const w = await browser.execute(
      () => document.getElementById('sidebar').getBoundingClientRect().width,
    );
    // 14rem * fs-nav (1) = 224 px, limitado por 40vw = 512 px.
    expect(w).toBeGreaterThanOrEqual(220);
    expect(w).toBeLessThanOrEqual(230);
  });
});
