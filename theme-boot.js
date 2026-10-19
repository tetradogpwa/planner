// Aplica tema, tamaños y colores propios antes del primer pintado. Script
// clásico (no módulo) cargado en <head>. Lógica completa y cálculo de
// `scheme` y `vars` en ui/settings/preferences.js.
(function () {
  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('a11yPrefs')) || {}; } catch (e) {}
  var root = document.documentElement;

  // 'light' / 'dark' se usan tal cual; 'custom', 'contrast-dark' y
  // 'contrast-light' ya traen su `scheme` guardado; el resto ('auto')
  // sigue al sistema.
  var theme = prefs.theme === 'light' || prefs.theme === 'dark'
    ? prefs.theme
    : (prefs.scheme === 'light' || prefs.scheme === 'dark')
      ? prefs.scheme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);

  if (typeof prefs.textScale === 'number') root.style.fontSize = prefs.textScale + '%';

  var vars = prefs.vars || {};
  for (var name in vars) {
    if (name.indexOf('--') === 0 && typeof vars[name] === 'string') root.style.setProperty(name, vars[name]);
  }
})();
