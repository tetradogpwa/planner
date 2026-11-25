// tests/unit/helpers/recargar-app.mjs
//
// «Recargar la app» es abrirla en un proceso nuevo: lo único que pasa
// de una a otra es el almacenamiento. Aquí se hace con un proceso hijo,
// y no con un `import` con query string (`context.js?recarga=1`), por
// dos razones:
//
//   1. Es lo que hace de verdad el usuario: cerrar la app y volver a
//      abrirla. Un `import` con query string solo crea otra instancia
//      del módulo dentro de la misma app.
//
//   2. El runner de Node mide la cobertura por URL EXACTA: si el mismo
//      fichero se importa con distintas URL, cada una se mide por
//      separado y la tabla de cobertura acaba enseñando la de una sola
//      de ellas (la última que se lee) en vez de la del conjunto. Con un
//      proceso hijo, context.js tiene una única URL y la tabla mide la
//      cobertura de verdad.

import { execFileSync } from 'node:child_process';

const MODULO_CONTEXT = new URL('../../../context.js', import.meta.url).href;

/**
 * Abre la app en un proceso nuevo, con el almacenamiento `almacen` (un
 * localStorage), y devuelve el valor de `expresion`: una expresión de
 * JavaScript que se evalúa en la app nueva, donde `Context` es el
 * estado global.
 */
export function recargarApp(almacen, expresion) {
  // El almacenamiento pasa entero al proceso nuevo.
  const datos = {};
  for (let i = 0; i < almacen.length; i++) {
    const clave = almacen.key(i);
    datos[clave] = almacen.getItem(clave);
  }

  const script = `
    const datos = JSON.parse(process.env.PLANNER_ALMACEN);
    globalThis.localStorage = {
      _datos: new Map(Object.entries(datos)),
      getItem(k)    { return this._datos.has(k) ? this._datos.get(k) : null; },
      setItem(k, v) { this._datos.set(k, String(v)); },
    };
    const { Context } = await import(process.env.PLANNER_MODULO);
    const resultado = eval(process.env.PLANNER_EXPRESION);
    process.stdout.write(JSON.stringify(resultado ?? null));
  `;

  const salida = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: {
      ...process.env,
      PLANNER_ALMACEN: JSON.stringify(datos),
      PLANNER_MODULO: MODULO_CONTEXT,
      PLANNER_EXPRESION: expresion,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return JSON.parse(salida);
}
