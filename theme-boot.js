// Aplica tema, tamaños y colores propios antes del primer pintado. Script
// clásico (no módulo) cargado en <head>. Lógica completa y cálculo de
// `scheme` y `vars` en ui/settings/preferences.js.
(function () {
  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('a11yPrefs')) || {}; } catch { /* preferencias ilegibles: valores por defecto */ }
  var root = document.documentElement;

  function esquemaDelSistema() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // El tema se decide por `theme` (lo que eligió el usuario) y no por el
  // `scheme` guardado: ese es el esquema que tenía el sistema cuando se
  // guardaron las preferencias, así que si el sistema cambió después el
  // primer pintado salía del color contrario (parpadeo) hasta que
  // preferences.js aplicaba el tema de verdad.
  //
  // 'light' / 'dark' se usan tal cual; 'custom', 'contrast-dark' y
  // 'contrast-light' ya traen su `scheme` guardado; el resto ('auto' o
  // lo que no esté guardado) sigue al sistema.
  var theme;
  if (prefs.theme === 'light' || prefs.theme === 'dark') {
    theme = prefs.theme;
  } else if (prefs.theme === 'auto' || !prefs.theme) {
    theme = esquemaDelSistema();
  } else {
    theme = (prefs.scheme === 'light' || prefs.scheme === 'dark')
      ? prefs.scheme
      : esquemaDelSistema();
  }
  root.setAttribute('data-theme', theme);

  if (typeof prefs.textScale === 'number') root.style.fontSize = prefs.textScale + '%';

  var vars = prefs.vars || {};
  for (var name in vars) {
    if (name.indexOf('--') === 0 && typeof vars[name] === 'string') root.style.setProperty(name, vars[name]);
  }
})();
