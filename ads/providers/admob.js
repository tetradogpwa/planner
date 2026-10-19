// Google AdMob nativo (Android) a través de src-tauri/plugins/tauri-plugin-admob.
// El banner es una vista nativa sobre el WebView: reservamos su altura
// con la variable CSS --ad-banner-height y la clase body.has-native-ad-banner.

let config = null;

const call = (cmd, args = {}) =>
  window.__TAURI__.core.invoke(`plugin:admob|${cmd}`, { args });

export default {
  name: 'admob',

  async init(cfg, { personalized }) {
    config = cfg;
    await call('initialize', { personalized });
  },

  async showBanner() {
    if (!config?.bannerUnit) return false;
    const { height } = await call('show_banner', {
      adUnitId: config.bannerUnit,
      position: 'bottom',
    });
    document.documentElement.style.setProperty('--ad-banner-height', `${height}px`);
    document.body.classList.add('has-native-ad-banner');
    return true;
  },

  async hideBanner() {
    await call('hide_banner');
    document.documentElement.style.removeProperty('--ad-banner-height');
    document.body.classList.remove('has-native-ad-banner');
  },

  async showInterstitial() {
    if (!config?.interstitialUnit) return false;
    await call('show_interstitial', { adUnitId: config.interstitialUnit });
    return true;
  },
};
