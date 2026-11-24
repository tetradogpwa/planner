// T-040 — Ajustes › Legal › Acerca de: el hash del frontend.
//
// El binario lleva incrustado el frontend (Tauri 2 lo mete como
// *blobs* en tiempo de compilación). Para saber qué frontend lleva
// cada build, el crate calcula el hash SHA-256 del contenido copiado
// y lo expone en `AppInfo`; el frontend lo muestra en «Acerca de».
//
// Aquí se comprueba el comportamiento observable: abriendo Ajustes ›
// Legal, el `dd#legal-app-frontend-hash` tiene que mostrar los
// primeros 12 caracteres del hash (los que se ven en pantalla), y
// tienen que ser hexadecimal.
//
// La comprobación de que el hash **cambia** al tocar un `.js` del
// frontend (y de que el binario lleva el asset nuevo) la hace
// `tools/test.sh` (`check_frontend_embebido`), porque necesita
// recompilar la app.

import {
  abrirAppNueva,
  navegarVistaAlt,
} from '../helpers.mjs';

describe('Acerca de: hash del frontend', () => {

  before(async () => {
    await abrirAppNueva();
  });

  it('Ajustes › Legal muestra el hash del frontend en «Acerca de»', async () => {
    // Ajustes › Legal (Alt+7).
    await navegarVistaAlt(7);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector('#ajustes-panel-legal')?.hidden === false,
      ),
      { timeout: 5_000, timeoutMsg: 'La pestaña Legal no se abrió tras Alt+7' },
    );

    // El `dd` del hash tiene que existir dentro de «Acerca de».
    const existe = await browser.execute(
      () => !!document.querySelector('#legal-app-frontend-hash'),
    );
    expect(existe).toBe(true);

    // Se espera a que se rellene: el frontend pide la info a Tauri y
    // la pinta cuando llega.
    await browser.waitUntil(
      async () => await browser.execute(() => {
        const dd = document.querySelector('#legal-app-frontend-hash');
        return !!dd && /^[0-9a-f]{12}$/.test(dd.textContent.trim());
      }),
      {
        timeout: 5_000,
        timeoutMsg: 'El hash del frontend no se pintó en «Acerca de»',
      },
    );

    // Lo que se ve son 12 caracteres hexadecimales.
    const texto = await browser.execute(
      () => document.querySelector('#legal-app-frontend-hash').textContent.trim(),
    );
    expect(texto).toMatch(/^[0-9a-f]{12}$/);

    // Y tiene que ser el principio del hash completo que lleva el
    // binario: los 12 primeros caracteres, en minúsculas.
    const hashCompleto = await browser.execute(async () => {
      const info = await window.__TAURI__.core.invoke('get_app_info');
      return info.frontend_hash ?? '';
    });
    expect(hashCompleto).toMatch(/^[0-9a-f]{64}$/);
    expect(texto).toBe(hashCompleto.slice(0, 12));
  });

  it('el hash que muestra coincide con el que lleva el binario', async () => {
    // La comprobación de que el hash de la pantalla es el del
    // binario, y no un texto cualquiera: se invoca al comando nativo
    // y se compara con lo pintado.
    const pintado = await browser.execute(
      () => document.querySelector('#legal-app-frontend-hash').textContent.trim(),
    );
    const delBinario = await browser.execute(async () => {
      const info = await window.__TAURI__.core.invoke('get_app_info');
      return (info.frontend_hash ?? '').slice(0, 12);
    });
    expect(pintado).toBe(delBinario);
  });
});
