// ─────────────────────────────────────────────────────────────────────
// ESLint del Planificador Semanal (T-037).
//
// La app NO lleva npm ni bundler: es JavaScript de navegador que se
// carga tal cual. Este linter no se empaqueta con la app (no está en
// WEB_ASSETS) y solo se usa en desarrollo y en el CI.
//
// Configuración plana (flat config) de ESLint 10.
//
// Qué se comprueba:
//   · Lo recomendado de ESLint (`eslint:recommended`): errores de
//     verdad (variables sin usar, referencias a globales que no
//     existen, bloques vacíos, comparaciones raras…).
//   · `eqeqeq`: el proyecto compara siempre con `===`/`!==`.
//   · `no-console`: en la app el `console.warn`/`console.error` se
//     usan a propósito (avisos al usuario y a la consola del
//     WebView), así que se permiten; el `console.log` no, salvo que
//     quien lo escriba ponga un `eslint-disable-next-line` que lo
//     justifique. En los scripts de `tools/` el `console.log` sí es
//     la salida del programa: ahí está permitido.
//
// Qué NO se comprueba (y por qué):
//   · El formato (sangrado, comillas, salto de línea). Eso lo marcan
//     `.editorconfig` y `.gitattributes`, y aplica también al HTML y
//     al CSS. Reformatear el código existente a mano sería un diff
//     imposible de revisar (y podría romper la maquetación), así que
//     aquí no se toca ni una línea de estilo.
//   · `vendor/`: es un bundle de terceros (html2pdf) que no es
//     nuestro y no se puede tocar.
//   · Los argumentos de los métodos de `back/`: es la capa más vieja
//     del proyecto, escrita con otro estilo (4 espacios, sin espacio
//     alrededor de los operadores). Ver el bloque de `back/**` más
//     abajo: solo se relajan los argumentos; las variables sin usar
//     se siguen mirando.
// ─────────────────────────────────────────────────────────────────────

const js = require('@eslint/js');
const globals = require('globals');

// Ficheros que nunca se lintean.
const IGNORADOS = [
  'node_modules/**',
  'vendor/**',        // bundle de terceros
  'dist/**',          // copia del frontend que genera build.rs
  'releases/**',
  'logs/**',
  'src-tauri/**',
  'tests/e2e/node_modules/**',
];

// El frontend de la app (lo que se empaqueta en Tauri).
const APP_MODULO = [
  'index.js',
  'context.js',
  'api.js',
  'monetization.js',
  'mcp-bridge.js',
  'ads/**/*.js',
  'back/**/*.js',
  'ui/**/*.js',
];

// `html2pdf` lo aporta el bundle de terceros que `index.html` carga
// con <script>: es una global del navegador, no un import.
const GLOBALS_APP = {
  ...globals.browser,
  html2pdf: 'readonly',
};

// WebdriverIO inyecta estas globales en los E2E (`browser`, `$`, `$$`
// y `expect`); Mocha aporta `describe`, `it`, `before`…
const GLOBALS_WDIO = {
  browser: 'readonly',
  $: 'readonly',
  $$: 'readonly',
  expect: 'readonly',
};

// Las unitarias simulan el navegador con stubs en `globalThis`
// (ventana, almacenamiento, eventos). No hay DOM, pero los nombres
// existen en el ámbito global cuando el test los define.
const STUBS_NAVEGADOR = {
  window: 'readonly',
  localStorage: 'readonly',
  CustomEvent: 'readonly',
  EventTarget: 'readonly',
  Blob: 'readonly',
  FileReader: 'readonly',
};

module.exports = [
  { ignores: IGNORADOS },

  // ── Base: lo recomendado de ESLint ────────────────────────────────
  js.configs.recommended,

  {
    // Una directiva `eslint-disable` que ya no hace falta es un fallo:
    // si alguien deja de usar `console.log`, la directiva sobrante
    // tiene que saltar para que se note.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },

  // ── El frontend de la app ─────────────────────────────────────────
  {
    files: APP_MODULO,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: GLOBALS_APP,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': ['error', {
        args: 'after-used',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // `theme-boot.js` es un script clásico: se carga en <head> antes de
  // que exista el DOM, sin `type="module"`.
  {
    files: ['theme-boot.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: GLOBALS_APP,
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
    },
  },

  // `sw.js` es el service worker: vive en su propio ámbito, con
  // `self`, `caches` y `clients`.
  {
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
    },
  },

  // ── `back/`: la capa más vieja ────────────────────────────────────
  {
    files: ['back/**/*.js'],
    rules: {
      // Los métodos abstractos declaran los parámetros que usan sus
      // subclases (`thisDayHas(from, dayFromOrigin)`): en la clase
      // base no se usan y `no-unused-vars` los marca. Por eso aquí
      // solo se miran las VARIABLES sin usar; los argumentos se
      // ignoran. Es la única concesión a esta capa: el resto de
      // reglas se aplica igual que en el resto del proyecto.
      'no-unused-vars': ['error', {
        args: 'none',
        vars: 'all',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // ── Utilidades y pruebas de Node ─────────────────────────────────
  {
    files: ['tools/**/*.mjs', 'tests/unit/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // En un script de consola el `console.log` ES la salida del
      // programa: aquí está permitido.
      'no-console': 'off',
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': ['error', {
        args: 'after-used',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // Las unitarias que simulan el navegador declaran sus stubs en
  // `globalThis`: sin esto, `window` o `localStorage` parecerían
  // globales inexistentes.
  {
    files: ['tests/unit/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...STUBS_NAVEGADOR },
    },
  },

  // ── Los E2E (WebdriverIO + Mocha) ─────────────────────────────────
  {
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,   // el código de `browser.execute()` se
        ...GLOBALS_WDIO,      // ejecuta dentro de la app real
        ...globals.mocha,     // describe/it/before… del framework
      },
    },
    rules: {
      // `console.log` en un test es la traza que se lee al depurar.
      // Aquí NO se permite por defecto: solo se acepta si quien lo
      // escribe pone un `eslint-disable-next-line no-console` que lo
      // justifique (los que ya hay en 03-datos.spec.mjs). Con
      // `reportUnusedDisableDirectives` arriba, una directiva que
      // sobra también es un error.
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': ['error', {
        args: 'after-used',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  // ── El propio linter ─────────────────────────────────────────────
  {
    files: ['eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
];
