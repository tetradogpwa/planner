// Google AdSense dentro del WebView (builds de escritorio).
// Ver https://support.google.com/adsense/answer/9274025

const SCRIPT_ID = 'adsbygoogle-js';

let config = null;
// Contenedores que hemos rellenado nosotros. El script de AdSense
// también mete sus propios <ins class="adsbygoogle"> en <body>, así
// que no podemos ocultar "todos los ins".
const filled = new Set();

function loadScript(clientId) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
    + `?client=${encodeURIComponent(clientId)}`;
  document.head.append(script);
}

export default {
  name: 'adsense',

  async init(cfg, { personalized }) {
    config = cfg;
    window.adsbygoogle = window.adsbygoogle || [];
    // Debe fijarse antes del primer push().
    window.adsbygoogle.requestNonPersonalizedAds = personalized ? 0 : 1;
    loadScript(cfg.clientId);
  },

  async showBanner(container) {
    if (!container || !config?.bannerUnit) return false;
    if (container.querySelector('ins.adsbygoogle')) return true;

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = config.clientId;
    ins.dataset.adSlot = config.bannerUnit;
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    if (config.testMode) ins.dataset.adtest = 'on';

    container.append(ins);
    container.hidden = false;
    filled.add(container);
    window.adsbygoogle.push({});
    return true;
  },

  async hideBanner() {
    filled.forEach(container => {
      container.querySelectorAll('ins.adsbygoogle').forEach(ins => ins.remove());
      container.hidden = true;
    });
    filled.clear();
  },

  // AdSense no ofrece intersticiales bajo demanda.
  async showInterstitial() { return false; },
};
