// ────────────────────────────────────────────────────────────────────
// monetization.js — Capa de monetización del frontend.
//
// Decide CUÁNDO mostrar anuncios (consentimiento, versión sin
// anuncios). CÓMO se muestran en cada plataforma lo resuelve
// ads/ads.js, que elige AdSense (escritorio) o AdMob (Android).
//
// Por defecto la app NO muestra anuncios. Para activarlos:
//   1. Rellena las claves en .env (ver .env.example).
//   2. Recompila (las claves se incrustan en el binario, ver
//      src-tauri/build.rs).
//   3. Coloca en la UI un contenedor <div id="ad-banner" hidden></div>
//      (solo lo usa AdSense; en Android el banner es nativo).
//
// Modelo "consentimiento o pago": si la build tiene anuncios, la app
// no se puede usar hasta que el usuario acepte los anuncios o pase a
// la versión de pago (ui/consent/). Si rechaza, se le ofrece el
// enlace PAID_VERSION_URL_* de su plataforma.
// ────────────────────────────────────────────────────────────────────

import {
  NO_ADS_CONFIG,
  loadAdsConfig,
  initAds,
  showBanner,
  hideBanner,
  showInterstitial,
} from './ads/ads.js';

// Estado local: nunca salimos de la app para hablar con el servidor.
const STATE_KEY = 'adsState';
const BANNER_CONTAINER_ID = 'ad-banner';

const CONSENT_VALUES = ['unknown', 'accept', 'reject', 'personalized', 'non_personalized'];
const CONSENT_GRANTED = ['accept', 'personalized', 'non_personalized'];

// Configuración de la build. No se persiste: viene del binario.
let config = NO_ADS_CONFIG;

function readLocalState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeLocalState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/**
 * Inicializa la capa de monetización.
 *
 * Llamar al cargar la app, después del primer render. Lee la
 * configuración de la capa nativa y, si procede, muestra anuncios.
 */
export async function initMonetization() {
  config = await loadAdsConfig();
  await refreshAds();
  return getCurrentState();
}

/**
 * Aplica el estado actual: muestra u oculta anuncios. Llamar tras
 * cambiar el consentimiento o tras una compra.
 */
export async function refreshAds() {
  if (!shouldShowAds()) {
    await hideBanner();
    return false;
  }
  const { consent } = getCurrentState();
  try {
    await initAds(config, { personalized: consent !== 'non_personalized' });
    await showBanner(document.getElementById(BANNER_CONTAINER_ID));
    return true;
  } catch (err) {
    console.warn('[monetization] no se pudieron mostrar anuncios:', err);
    return false;
  }
}

/**
 * Muestra un intersticial si los anuncios están activos. Resuelve
 * cuando el usuario lo cierra (o enseguida si no hay intersticial).
 */
export async function maybeShowInterstitial() {
  if (!shouldShowAds()) return false;
  try {
    return await showInterstitial();
  } catch (err) {
    console.warn('[monetization] intersticial falló:', err);
    return false;
  }
}

/**
 * `true` si hay que bloquear la app con la pantalla de consentimiento:
 * la build tiene anuncios, no se han quitado y el usuario no los ha
 * aceptado (no ha decidido aún o los ha rechazado).
 */
export function needsConsent() {
  const state = getCurrentState();
  return state.config.provider !== 'none' &&
    state.adsRemoved === false &&
    !CONSENT_GRANTED.includes(state.consent);
}

/**
 * `true` si esta build muestra anuncios a este usuario (no ha pasado a
 * la versión sin anuncios). Sirve para enseñar «Quitar anuncios».
 */
export function hasAds() {
  const state = getCurrentState();
  return state.config.provider !== 'none' && state.adsRemoved === false;
}

/**
 * Abre la versión de pago (tienda o web) en el navegador del sistema.
 * Devuelve `false` si esta build no tiene URL configurada.
 */
export async function openPaidVersion() {
  const url = config.paidVersionUrl;
  if (!url) return false;
  const shell = window.__TAURI__?.shell;
  if (shell) await shell.open(url);
  else window.open(url, '_blank', 'noopener');
  return true;
}

/**
 * Marca los anuncios como "quitados" (compra in-app realizada).
 * Esta función la llamará el frontend tras confirmar el pago.
 *
 * Si quieres que el flag se borre al reinstalar, usa el flujo de
 * verificación de compra de la tienda (recommended).
 */
export async function markAdsRemoved() {
  const local = readLocalState() ?? {};
  local.adsRemoved = true;
  writeLocalState(local);
  await refreshAds();
}

/**
 * Guarda la decisión del banner RGPD. Llamar después a `refreshAds()`.
 */
export function setConsent(value) {
  if (!CONSENT_VALUES.includes(value)) {
    throw new Error(`Consentimiento inválido: ${value}`);
  }
  const local = readLocalState() ?? {};
  local.consent = value;
  writeLocalState(local);
}

/**
 * Devuelve la decisión actual del usuario sobre consentimiento y
 * versión "sin anuncios", junto con la configuración de la build.
 */
export function getCurrentState() {
  const local = readLocalState() ?? {};
  return {
    consent: local.consent ?? 'unknown',
    adsRemoved: local.adsRemoved ?? config.adsRemovedDefault,
    config,
  };
}

/**
 * `true` solo si la build tiene proveedor, el usuario no ha quitado
 * los anuncios y ha dado consentimiento.
 */
export function shouldShowAds() {
  const state = getCurrentState();
  return Boolean(
    state.config.provider !== 'none' &&
    state.adsRemoved === false &&
    CONSENT_GRANTED.includes(state.consent)
  );
}

// ── Pantalla de consentimiento ──────────────────────────────────────
//
// Implementada en ui/consent/. Reglas que debe mantener:
//   * "Aceptar" y "Rechazar" al mismo nivel visual y a un solo clic.
//     Nada de casillas premarcadas ni "scroll to accept".
//   * Rechazar no se castiga con insistencia: lleva a la versión de
//     pago, desde donde se puede volver a aceptar.
//   * El consentimiento se vuelve a pedir como máximo cada 12 meses
//     (según RGPD / EDPB Guidelines 03/2022).
