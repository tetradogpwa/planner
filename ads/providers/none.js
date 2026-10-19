// Proveedor nulo: build sin claves, navegador sin Tauri o anuncios quitados.
export default {
  name: 'none',
  async init() {},
  async showBanner() { return false; },
  async hideBanner() {},
  async showInterstitial() { return false; },
};
