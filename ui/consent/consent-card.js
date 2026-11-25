// ────────────────────────────────────────────────────────────────────
// consent-card.js
//
// Pantalla completa de "consentimiento o pago" (ver monetization.js).
//
//   mode 'gate'     → al arrancar, antes de pintar la app:
//                       ask      → aceptar (personalizados / no) o rechazar
//                       paywall  → tras rechazar: versión de pago o aceptar
//   mode 'upgrade'  → desde «Quitar anuncios» del menú:
//                       upgrade  → versión de pago, retirar consentimiento
//                                  (vuelve a `ask`) o seguir con anuncios
//
// `init()` resuelve cuando el usuario puede usar la app (ha aceptado o
// ha cerrado el diálogo). Si nunca acepta, no resuelve: la app sigue
// bloqueada en la pantalla de pago.
// ────────────────────────────────────────────────────────────────────

import {
  setConsent,
  refreshAds,
  getCurrentState,
  openPaidVersion,
} from '../../monetization.js';
import { montarTarjeta } from '../base-card.js';

const BLOCKED_SELECTORS = ['.topbar', '.sidebar-overlay', '.layout'];

export class ConsentCard {
  constructor(root, { mode = 'gate' } = {}) {
    this.root = root;
    this.mode = mode;
    this.done = new Promise(resolve => { this.resolveDone = resolve; });
  }

  /** Monta la tarjeta. Devuelve false si su HTML o su CSS no se
   *  pudieron cargar: en ese caso la vista ya muestra el aviso. */
  async init() {
    const html = await montarTarjeta(
      this.root,
      './ui/consent/consent-card.html',
      './ui/consent/consent-card.css',
    );
    if (!html) return false;
    this.mount();
    return this.done;
  }

  mount() {
    this.steps = {};
    this.root.querySelectorAll('[data-step]').forEach(el => {
      this.steps[el.dataset.step] = el;
    });

    this.root.querySelectorAll('[data-consent]').forEach(btn =>
      btn.addEventListener('click', () => this.choose(btn.dataset.consent))
    );

    const actions = {
      buy:      () => openPaidVersion(),
      ask:      () => this.show('ask'),
      withdraw: () => this.withdraw(),
      close:    () => this.close(),
    };
    this.root.querySelectorAll('[data-action]').forEach(btn =>
      btn.addEventListener('click', actions[btn.dataset.action])
    );

    const { config, consent } = getCurrentState();
    if (!config.paidVersionUrl) {
      this.root.querySelectorAll('[data-action="buy"]').forEach(b => { b.hidden = true; });
      this.root.querySelectorAll('.consent-no-url').forEach(p => { p.hidden = false; });
    }

    this.setBlocked(true);
    if (this.mode === 'upgrade')    this.show('upgrade');
    else if (consent === 'reject')  this.show('paywall');
    else                            this.show('ask');
  }

  choose(value) {
    setConsent(value);
    if (value === 'reject') {
      this.show('paywall');
      return;
    }
    this.close();
    refreshAds();
  }

  /**
   * Retira el consentimiento y vuelve a la pantalla inicial. Recarga
   * para descargar el script de AdSense ya inyectado; al arrancar sin
   * consentimiento se muestra de nuevo la pantalla de consentimiento.
   */
  async withdraw() {
    setConsent('unknown');
    await refreshAds();   // en Android quita el banner nativo
    location.reload();
  }

  show(step) {
    Object.entries(this.steps).forEach(([name, el]) => { el.hidden = name !== step; });
    // Foco en el título, no en un botón: así ninguna opción destaca.
    this.steps[step].querySelector('h2').focus();
  }

  setBlocked(blocked) {
    BLOCKED_SELECTORS.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.inert = blocked;
    });
  }

  close() {
    this.setBlocked(false);
    this.root.innerHTML = '';
    this.resolveDone();
  }
}
