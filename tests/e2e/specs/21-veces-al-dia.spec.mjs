// T-051: las etiquetas de las veces de una tarea que se repite varias
// veces al día.
//
// Con Veces/día = 3, cada vez tiene que salir con su propia etiqueta
// ("1/3", "2/3", "3/3"), tanto en la vista Semana como en el PDF.
// Antes se ponían franjas horarias ("0–12H" y "12–24H"): con tres
// veces al día la segunda y la tercera salían con la MISMA etiqueta
// ("12–24H") y no se distinguían una vez de otra.
//
// El recorrido:
//   1. Se crea una tarea diaria con tres veces al día desde el
//      formulario, como lo haría una persona.
//   2. En la Semana, el día de hoy muestra tres insignias con tres
//      etiquetas distintas.
//   3. En el PDF de la semana, las mismas tres etiquetas.

import {
  abrirAppNueva,
  irASemana,
  irAImprimir,
  esperarStatus,
} from '../helpers.mjs';

describe('Veces al día: cada vez con su etiqueta (T-051)', () => {

  before(async () => {
    await abrirAppNueva();

    // La tarea se crea desde el formulario: nombre, veces/día y tipo
    // de repetición.
    await $('#taskName').setValue('Tres veces');
    await $('#timesPerDay').setValue('3');
    await $('input[name="repeat"][value="daily"]').click();
    await $('#addTaskBtn').click();
  });

  it('la Semana muestra las tres etiquetas distintas', async () => {
    await irASemana();

    const insignias = await browser.execute(() => {
      const celda = document.querySelector('#view-week .day-cell.is-today');
      if (!celda) return [];
      return Array.from(celda.querySelectorAll('.task-badge'))
        .map(b => b.textContent.trim());
    });

    expect(insignias).toEqual([
      'TRES VECES · 1/3',
      'TRES VECES · 2/3',
      'TRES VECES · 3/3',
    ]);
  });

  it('el PDF muestra las tres etiquetas distintas', async () => {
    await irAImprimir();

    // Antes de exportar se apunta qué nodos se añaden al <body>: el
    // contenedor que se convierte en PDF está entre ellos (esto es lo
    // que hace también la prueba del XSS del PDF).
    await browser.execute(() => {
      window.__nodos = [];
      const obs = new MutationObserver(muts => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1) window.__nodos.push(n);
          }
        }
      });
      obs.observe(document.body, { childList: true });
    });

    await $('#printWeekBtn').click();
    await esperarStatus('#printStatus', '✅ PDF generado', 30_000);

    // Las etiquetas del PDF son las que van entre paréntesis
    // ("(1/3)"). Se comparan las DISTINTAS: si la segunda y la tercera
    // salieran con la misma etiqueta, aquí solo habría dos.
    const etiquetas = await browser.execute(() => {
      const nodos = window.__nodos ?? [];
      const texto = nodos.map(n => n.textContent ?? '').join('\n');
      return [...new Set(texto.match(/\(\d+\/\d+\)/g) ?? [])].sort();
    });

    expect(etiquetas).toEqual(['(1/3)', '(2/3)', '(3/3)']);
  });
});
