// T-057: los textos y nombres coherentes en la interfaz.
//
// Aquí no hay DOM: se miran los ficheros que se empaquetan en la app
// (index.html, index.js, manifest.json, index.css) y los que nombran
// las entradas del menú por escrito (la lista de atajos y la tabla de
// atajos de la declaración de accesibilidad). Lo que se comprueba es:
//
//  - que el color de la barra del navegador (el `theme-color`) sea el
//    mismo en los dos sitios donde se declara y que sea el del tema por
//    defecto: el de la barra superior y el menú (--panel del bloque
//    `:root` de index.css, que es el tema oscuro, el que se ve sin
//    preferencias guardadas);
//  - que las entradas del menú se llamen igual en todos los sitios que
//    las nombran: el menú (index.html), la lista de atajos
//    (ui/shortcuts/shortcuts-list.html, que se inyecta tal cual en el
//    diálogo de ayuda y en Ajustes › Accesibilidad) y la tabla de
//    atajos de la declaración de accesibilidad (legal/ACCESSIBILITY.md,
//    que la app muestra en Ajustes › Legal). Un renombrado del menú
//    sin propagar deja estos textos viejos y la prueba se pone roja.
//
// El nombre de la app y las etiquetas del menú se comprueban en los
// E2E (tests/e2e/specs/26-textos-interfaz.spec.mjs), que miran lo que
// ve la persona.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/unit/ → tests/ → raíz del repo.
const RAIZ = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const leer = (...partes) => readFileSync(join(RAIZ, ...partes), 'utf8');

const html     = leer('index.html');
const js       = leer('index.js');
const manifest = JSON.parse(leer('manifest.json'));
const css      = leer('index.css');
// Lista de atajos compartida por el diálogo de ayuda y Ajustes ›
// Accesibilidad: nombra las entradas del menú.
const atajosHtml = leer('ui/shortcuts/shortcuts-list.html');

// Declaraciones de accesibilidad: la que muestra la app y la plantilla
// que se copia a `legal/` al publicar (docs/publicacion-comercial/README.md).
const DECLARACIONES = [
  'legal/ACCESSIBILITY.md',
  'docs/publicacion-comercial/legal/ACCESSIBILITY.md',
];

/** El color del panel (barra superior y menú) del tema por defecto. */
function panelPorDefecto() {
  // El primer bloque `:root {` de index.css es el tema por defecto
  // (el oscuro); el claro va aparte, en `:root[data-theme="light"]`.
  const bloque = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(bloque, 'index.css tiene que tener un bloque :root con los tokens del tema');
  const panel = bloque[1].match(/--panel:\s*(#[0-9a-f]{6})/i);
  assert.ok(panel, 'el tema por defecto tiene que definir --panel');
  return panel[1].toLowerCase();
}

/** El color de la barra del navegador que declara el index.html. */
function themeColorDelHtml() {
  const meta = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/);
  assert.ok(meta, 'index.html tiene que declarar el meta theme-color');
  return meta[1].toLowerCase();
}

/** La etiqueta visible de cada opción del menú lateral (index.html). */
function etiquetasDelMenu() {
  const etiquetas = {};
  const botones = /<button class="nav-item[^"]*"[^>]*data-view="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g;
  for (const [, vista, contenido] of html.matchAll(botones)) {
    const label = contenido.match(/<span class="nav-label">([^<]*)<\/span>/);
    if (label) etiquetas[vista] = label[1].trim();
  }
  return etiquetas;
}

/** Qué vista abre cada atajo Alt+N (el `viewMap` de index.js). */
function atajosDeVistas() {
  const bloque = js.match(/const\s+viewMap\s*=\s*\{([^}]*)\}/);
  assert.ok(bloque, 'index.js tiene que declarar el mapa de atajos Alt+N de las vistas');
  const mapa = {};
  for (const [, tecla, vista] of bloque[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) {
    mapa[tecla] = vista;
  }
  return mapa;
}

/** Los pares (tecla, descripción) de la lista de atajos en HTML. */
function paresDeLaLista() {
  const pares = [];
  const entradas = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
  for (const [, tecla, desc] of atajosHtml.matchAll(entradas)) {
    const limpio = t => t.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    pares.push({ tecla: limpio(tecla), desc: limpio(desc) });
  }
  return pares;
}

/** Las filas de la tabla de atajos de un Markdown de accesibilidad. */
function filasDeLaTabla(md) {
  const filas = {};
  for (const [, tecla, desc] of md.matchAll(/\|\s*`Alt`\s*\+\s*`(\d)`\s*\|\s*(.+?)\s*\|/g)) {
    filas[tecla] = desc.replace(/\*/g, '').trim();
  }
  return filas;
}

test('el manifest y el index.html ponen el mismo color en la barra del navegador', () => {
  assert.equal(
    manifest.theme_color.toLowerCase(),
    themeColorDelHtml(),
    'el theme_color del manifest y el del index.html tienen que ser el mismo',
  );
});

test('el color de la barra del navegador es el del panel del tema por defecto', () => {
  assert.equal(
    themeColorDelHtml(),
    panelPorDefecto(),
    'el theme-color tiene que ser el color de la barra superior y el menú',
  );
});

test('la lista de atajos llama a las vistas como las llama el menú', () => {
  const etiquetas = etiquetasDelMenu();
  const atajos = atajosDeVistas();
  const pares = paresDeLaLista();

  for (const [tecla, vista] of Object.entries(atajos)) {
    const etiqueta = etiquetas[vista];
    assert.ok(etiqueta, `el menú tiene que tener una entrada para la vista "${vista}"`);
    const par = pares.find(p => p.tecla === `Alt + ${tecla}`);
    assert.ok(par, `la lista de atajos tiene que describir Alt+${tecla}`);
    assert.equal(
      par.desc,
      `Ir a ${etiqueta}`,
      `la lista de atajos dice "${par.desc}" y el menú llama a esa vista "${etiqueta}"`,
    );
  }
});

test('la declaración de accesibilidad llama a las vistas como las llama el menú', () => {
  const etiquetas = etiquetasDelMenu();
  const atajos = atajosDeVistas();

  for (const fichero of DECLARACIONES) {
    const filas = filasDeLaTabla(leer(fichero));
    for (const [tecla, vista] of Object.entries(atajos)) {
      const etiqueta = etiquetas[vista];
      assert.ok(etiqueta, `el menú tiene que tener una entrada para la vista "${vista}"`);
      assert.ok(filas[tecla], `${fichero} tiene que describir el atajo Alt+${tecla}`);
      assert.equal(
        filas[tecla],
        `Ir a ${etiqueta}`,
        `${fichero} dice "${filas[tecla]}" y el menú llama a esa vista "${etiqueta}"`,
      );
    }
  }
});
