// ────────────────────────────────────────────────────────────────────
// ads/ads.js — Fachada de anuncios independiente de la plataforma.
//
// El resto de la app solo usa estas funciones. Qué SDK hay debajo lo
// decide la capa nativa (src-tauri/src/ads.rs) según para qué se ha
// compilado:
//
//   Linux / Windows → providers/adsense.js  (HTML dentro del WebView)
//   Android         → providers/admob.js    (vista nativa vía plugin)
//   sin claves/PWA  → providers/none.js     (no hace nada)
//
// Contrato que cumple cada proveedor (todas las funciones async):
//   name                     → 'adsense' | 'admob' | 'none'
//   init(config, { personalized })
//                            → se puede llamar varias veces (p. ej. al
//                              cambiar el consentimiento)
//   showBanner(container)    → true si muestra algo. AdSense pinta
//                              dentro de `container`; AdMob lo ignora
//                              y ancla un banner nativo abajo.
//   hideBanner()
//   showInterstitial()       → true si se mostró. Resuelve al cerrarlo.
// ────────────────────────────────────────────────────────────────────

import none from './providers/none.js';

const PROVIDERS = {
  adsense: () => import('./providers/adsense.js'),
  admob:   () => import('./providers/admob.js'),
};

export const NO_ADS_CONFIG = Object.freeze({
  provider: 'none',
  clientId: '',
  bannerUnit: '',
  interstitialUnit: '',
  testMode: false,
  adsRemovedDefault: false,
  paidVersionUrl: '',
});

let provider = none;

/** Lee de la capa nativa la configuración de esta build. */
export async function loadAdsConfig() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return NO_ADS_CONFIG;   // navegador / PWA
  try {
    return await invoke('get_ads_config');
  } catch (err) {
    console.warn('[ads] no se pudo leer la configuración:', err);
    return NO_ADS_CONFIG;
  }
}

/** Selecciona e inicializa el proveedor indicado en `config.provider`. */
export async function initAds(config, { personalized }) {
  const load = PROVIDERS[config.provider];
  if (load && provider.name !== config.provider) {
    provider = (await load()).default;
  }
  await provider.init(config, { personalized });
  return provider.name;
}

export const showBanner       = (container) => provider.showBanner(container);
export const hideBanner       = ()          => provider.hideBanner();
export const showInterstitial = ()          => provider.showInterstitial();
export const activeProvider   = ()          => provider.name;
