// ────────────────────────────────────────────────────────────────────
// terms-card.js
//
// Pantalla completa de aceptación de términos. Es lo primero que se
// ve, antes incluso del consentimiento de anuncios:
//
//   aceptar   → se guarda y la app continúa
//   rechazar  → se cierra la app (comando nativo `exit_app`)
//
// La versión aceptada es la fecha de "Última actualización" de los
// documentos: si cambias un texto y su fecha, se vuelve a pedir.
// ────────────────────────────────────────────────────────────────────

import { renderMarkdown } from '../legal/legal-card.js';

const STORAGE_KEY = 'termsAccepted';

const DOCS = {
  TERMS:   './legal/TERMS.md',
  EULA:    './legal/EULA.md',
  PRIVACY: './legal/PRIVACY.md',
};
// Documentos que se aceptan (la privacidad solo se informa).
const ACCEPTED_DOCS = ['TERMS', 'EULA'];

const fetchText = (url) => fetch(url).then(r => r.text());

function lastUpdated(markdown) {
  return markdown.match(/\*\*Última actualización:\*\*\s*(.+)/)?.[1].trim() ?? '';
}

async function currentVersion() {
  const texts = await Promise.all(ACCEPTED_DOCS.map(key => fetchText(DOCS[key])));
  return ACCEPTED_DOCS.map((key, i) => `${key}:${lastUpdated(texts[i])}`).join('|');
}

function readAccepted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))?.version ?? null;
  } catch {
    return null;
  }
}

/** `true` si el usuario ya aceptó la versión vigente de los términos. */
export async function termsAccepted() {
  return readAccepted() === await currentVersion();
}

async function exitApp() {
  try {
    await window.__TAURI__.core.invoke('exit_app');
  } catch {
    window.close();   // navegador: solo funciona si la abrió un script
  }
}

export class TermsCard {
  constructor(root) {
    this.root = root;
    this.cache = {};
    this.done = new Promise(resolve => { this.resolveDone = resolve; });
  }

  /** Resuelve cuando el usuario acepta. Si rechaza, la app se cierra. */
  async init() {
    const [html, css] = await Promise.all([
      fetchText('./ui/terms/terms-card.html'),
      fetchText('./ui/terms/terms-card.css'),
    ]);
    this.root.innerHTML = `<style>${css}</style>${html}`;
    this.mount();
    return this.done;
  }

  mount() {
    this.docEl = this.root.querySelector('.terms-doc');
    this.tabs  = [...this.root.querySelectorAll('.terms-tab')];
    this.tabs.forEach(tab =>
      tab.addEventListener('click', () => this.showDoc(tab.dataset.doc))
    );
    // Navegación por teclado del tablist: flechas izquierda/derecha e
    // Inicio/Fin cambian de pestaña y mueven el foco. Solo la pestaña
    // seleccionada tiene tabindex=0 (las demás -1).
    this.tablist = this.root.querySelector('[role="tablist"]');
    this.tablist.addEventListener('keydown', (e) => {
      const current = this.tabs.indexOf(document.activeElement);
      if (current < 0) return;
      let target = -1;
      switch (e.key) {
        case 'ArrowLeft':  target = (current - 1 + this.tabs.length) % this.tabs.length; break;
        case 'ArrowRight': target = (current + 1) % this.tabs.length; break;
        case 'Home':       target = 0; break;
        case 'End':        target = this.tabs.length - 1; break;
      }
      if (target < 0) return;
      e.preventDefault();
      const tab = this.tabs[target];
      tab.focus();
      this.showDoc(tab.dataset.doc);
    });
    this.root.querySelector('[data-action="accept"]')
      .addEventListener('click', () => this.accept());
    this.root.querySelector('[data-action="reject"]')
      .addEventListener('click', () => this.reject());

    this.showDoc('TERMS');
    this.root.querySelector('h2').focus();
  }

  async showDoc(key) {
    // Tabindex itinerante: solo la pestaña activa es la siguiente en
    // el recorrido con Tab (el patrón ARIA tablist).
    this.tabs.forEach(t => {
      const isSelected = t.dataset.doc === key;
      t.setAttribute('aria-selected', String(isSelected));
      t.setAttribute('tabindex', isSelected ? '0' : '-1');
    });
    // El panel siempre expone qué pestaña lo controla para que los
    // lectores de pantalla anuncien el nombre al entrar.
    const activeTab = this.tabs.find(t => t.dataset.doc === key);
    if (activeTab) this.docEl.setAttribute('aria-labelledby', activeTab.id);
    try {
      this.cache[key] ??= renderMarkdown(await fetchText(DOCS[key]));
      this.docEl.innerHTML = this.cache[key];
    } catch (err) {
      this.docEl.textContent = `No se ha podido cargar el documento (${err.message}).`;
    }
    this.docEl.scrollTop = 0;
  }

  async accept() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: await currentVersion(),
      acceptedAt: new Date().toISOString(),
    }));
    this.root.innerHTML = '';
    this.resolveDone();
  }

  async reject() {
    await exitApp();
    // Si no se ha podido cerrar (navegador), dejamos la app bloqueada.
    this.root.querySelector('.terms-actions').hidden = true;
    this.root.querySelector('.terms-closed').hidden = false;
  }
}
