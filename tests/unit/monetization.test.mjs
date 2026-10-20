// Pruebas de la capa de monetización (monetization.js).
//
// El módulo decide si la app debe mostrar la pantalla de
// consentimiento de cookies o el botón "Quitar anuncios" según
// tres variables:
//   - `config.provider` (de la capa nativa; "none" si la build no
//     lleva claves de anuncios)
//   - `adsRemoved` (local)
//   - `consent` (local)
//
// T-023 ha dejado la build actual sin claves, así que `provider`
// vale "none". La app no debe mostrar el consentimiento ni el
// botón "Quitar anuncios" (lo aplica `index.js` con `hasAds()`
// y `updateRemoveAdsButton()`).
//
// Estas pruebas montan un localStorage mínimo y un stub de
// `window.__TAURI__` que devuelve la configuración de Ads.
// No imitamos la lógica de `monetization.js`: la ejecutamos tal
// cual y leemos su salida.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Stubs de navegador ──────────────────────────────────────────────────

class MemoryStorage {
  constructor() { this.m = new Map(); }
  getItem(k)    { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear()       { this.m.clear(); }
  key(i)        { return [...this.m.keys()][i] ?? null; }
  get length()  { return this.m.size; }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
// `window` mínimo: la app accede a `window.__TAURI__` y a `document`
// desde `ads/providers/adsense.js`. Como aquí probamos el gating de
// `monetization.js`, no necesitamos un DOM completo: cualquier
// intento de tocar `document` produce una excepción capturada por
// `refreshAds()`, que devuelve `false` (ver `monetization.js:80`).
globalThis.window      = globalThis.window || {};
// `provider` por defecto: "none" (build sin claves). Cada test puede
// redefinirlo antes del import dinámico si lo necesita.
globalThis.window.__TAURI__ = {
  core: {
    invoke: async (cmd) => {
      if (cmd !== 'get_ads_config') throw new Error(`Comando no esperado: ${cmd}`);
      return {
        provider: 'none',
        clientId: '',
        bannerUnit: '',
        interstitialUnit: '',
        testMode: false,
        adsRemovedDefault: false,
        paidVersionUrl: '',
      };
    },
  },
};

const {
  initMonetization,
  needsConsent,
  hasAds,
  shouldShowAds,
  getCurrentState,
  markAdsRemoved,
} = await import('../../monetization.js');

beforeEach(() => storage.clear());

// ── 1. Con provider "none" la app no muestra consentimiento ni
//       botón "Quitar anuncios" ─────────────────────────────────────

test('provider "none": initMonetization() deja needsConsent=false y hasAds()=false', async () => {
  // Limpia cualquier estado residual: sin esto el segundo test
  // hereda el flag `adsRemoved` guardado en el anterior.
  storage.clear();
  const state = await initMonetization();
  assert.equal(state.config.provider, 'none');
  assert.equal(needsConsent(), false);
  assert.equal(hasAds(),        false);
  assert.equal(shouldShowAds(), false);
});

test('provider "none": aunque el usuario haya decidido "aceptar" antes, no se muestran anuncios', async () => {
  storage.clear();
  // Forzamos una decisión "accept" almacenada: con provider 'none'
  // no debe bastar para mostrar nada.
  storage.setItem('adsState', JSON.stringify({ consent: 'accept', adsRemoved: false }));
  await initMonetization();
  assert.equal(shouldShowAds(), false);
  assert.equal(hasAds(),        false);
  assert.equal(needsConsent(),  false);
});

test('provider "none": con adsRemoved guardado a true, hasAds() sigue en false', async () => {
  storage.clear();
  storage.setItem('adsState', JSON.stringify({ adsRemoved: true }));
  await initMonetization();
  assert.equal(hasAds(),       false);
  assert.equal(shouldShowAds(), false);
});

// ── 2. La capa de monetización es coherente con provider "adsense"
//       (caso hipotético, para verificar que el gating realmente
//       depende del provider) ─────────────────────────────────────

test('provider "adsense": needsConsent()=true hasta que el usuario consienta o quite los anuncios', async () => {
  storage.clear();
  // Reconfiguramos el stub nativo para esta prueba, sin reiniciar
  // el módulo: el `config` interno se reescribe en cada
  // `initMonetization()`. Pero como en este módulo `config` se
  // guarda en una variable capturada por closure, hay que
  // sobrescribir `initMonetization` re-importando: usamos el truco
  // de sustituir `window.__TAURI__.core.invoke` antes de la
  // siguiente llamada (monetization.js llama a loadAdsConfig cada
  // vez).
  globalThis.window.__TAURI__.core.invoke = async () => ({
    provider: 'adsense',
    clientId: 'ca-pub-test',
    bannerUnit: 'slot',
    interstitialUnit: '',
    testMode: true,
    adsRemovedDefault: false,
    paidVersionUrl: '',
  });
  await initMonetization();
  assert.equal(getCurrentState().config.provider, 'adsense');
  assert.equal(hasAds(),        true);
  // Consentimiento todavía desconocido → debe pedir consentimiento.
  assert.equal(needsConsent(),  true);
  assert.equal(shouldShowAds(), false);
});

test('provider "adsense": con consent="accept" guardado, shouldShowAds()=true', async () => {
  storage.clear();
  globalThis.window.__TAURI__.core.invoke = async () => ({
    provider: 'adsense',
    clientId: 'ca-pub-test',
    bannerUnit: 'slot',
    interstitialUnit: '',
    testMode: true,
    adsRemovedDefault: false,
    paidVersionUrl: '',
  });
  storage.setItem('adsState', JSON.stringify({ consent: 'accept', adsRemoved: false }));
  await initMonetization();
  assert.equal(needsConsent(),  false);
  assert.equal(hasAds(),        true);
  assert.equal(shouldShowAds(), true);
});

test('provider "adsense" → markAdsRemoved() apaga hasAds() y shouldShowAds()', async () => {
  storage.clear();
  globalThis.window.__TAURI__.core.invoke = async () => ({
    provider: 'adsense',
    clientId: 'ca-pub-test',
    bannerUnit: 'slot',
    interstitialUnit: '',
    testMode: true,
    adsRemovedDefault: false,
    paidVersionUrl: '',
  });
  storage.setItem('adsState', JSON.stringify({ consent: 'accept', adsRemoved: false }));
  await initMonetization();
  assert.equal(hasAds(),        true);
  assert.equal(shouldShowAds(), true);
  await markAdsRemoved();
  assert.equal(hasAds(),        false);
  assert.equal(shouldShowAds(), false);
  assert.equal(needsConsent(),  false);
});
