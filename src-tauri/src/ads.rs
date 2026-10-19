//! Configuración de anuncios por plataforma.
//!
//! Los valores se incrustan en compilación desde `.env` (ver `build.rs`),
//! así que el binario distribuido no necesita ningún `.env` al ejecutarse.
//!
//! El frontend recibe siempre la misma forma (`AdsConfig`) y elige el
//! adaptador JS según `provider`:
//!
//! | Plataforma        | provider   |
//! |-------------------|------------|
//! | Linux / Windows   | `adsense`  |
//! | Android           | `admob`    |
//! | Sin claves / iOS  | `none`     |

use serde::Serialize;

/// IDs de prueba oficiales de Google para AdMob. Se usan en modo test
/// para no generar impresiones inválidas con las unidades reales.
#[cfg(target_os = "android")]
const ADMOB_TEST_BANNER: &str = "ca-app-pub-3940256099942544/6300978111";
#[cfg(target_os = "android")]
const ADMOB_TEST_INTERSTITIAL: &str = "ca-app-pub-3940256099942544/1033173712";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdsConfig {
    /// `"adsense"`, `"admob"` o `"none"`.
    pub provider: &'static str,
    /// AdSense: `ca-pub-…`. AdMob: `ca-app-pub-…~…` (App ID).
    pub client_id: &'static str,
    /// AdSense: slot. AdMob: ad unit del banner.
    pub banner_unit: &'static str,
    /// Solo AdMob: ad unit del intersticial (AdSense no tiene).
    pub interstitial_unit: &'static str,
    /// Anuncios de prueba. Por defecto activo en builds debug.
    pub test_mode: bool,
    /// Valor inicial del flag "sin anuncios" si el usuario no tiene
    /// ninguno guardado.
    pub ads_removed_default: bool,
    /// Adónde se manda al usuario que rechaza los anuncios (ficha de
    /// la versión de pago en la tienda o web). Vacío = sin enlace.
    pub paid_version_url: &'static str,
}

/// Lee una variable incrustada por `build.rs` (vacía = no definida).
macro_rules! build_env {
    ($key:literal) => {
        option_env!($key).unwrap_or("")
    };
}

fn flag(value: &str) -> Option<bool> {
    match value {
        "" => None,
        v => Some(v.eq_ignore_ascii_case("true")),
    }
}

/// Configuración para la plataforma para la que se ha compilado.
pub fn current() -> AdsConfig {
    let test_mode = flag(build_env!("ADS_TEST_MODE")).unwrap_or(cfg!(debug_assertions));
    let ads_removed_default = flag(build_env!("ADS_REMOVED_DEFAULT")).unwrap_or(false);

    #[cfg(target_os = "android")]
    let paid_version_url = build_env!("PAID_VERSION_URL_ANDROID");
    #[cfg(desktop)]
    let paid_version_url = build_env!("PAID_VERSION_URL_DESKTOP");
    #[cfg(target_os = "ios")]
    let paid_version_url = "";

    let none = AdsConfig {
        provider: "none",
        client_id: "",
        banner_unit: "",
        interstitial_unit: "",
        test_mode,
        ads_removed_default,
        paid_version_url,
    };

    #[cfg(target_os = "android")]
    {
        let app_id = build_env!("GOOGLE_ADMOB_APP_ID");
        if app_id.is_empty() {
            return none;
        }
        let (banner_unit, interstitial_unit) = if test_mode {
            (ADMOB_TEST_BANNER, ADMOB_TEST_INTERSTITIAL)
        } else {
            (
                build_env!("GOOGLE_ADMOB_BANNER_ID"),
                build_env!("GOOGLE_ADMOB_INTERSTITIAL_ID"),
            )
        };
        AdsConfig {
            provider: "admob",
            client_id: app_id,
            banner_unit,
            interstitial_unit,
            ..none
        }
    }

    #[cfg(desktop)]
    {
        let client_id = build_env!("GOOGLE_ADSENSE_CLIENT");
        if client_id.is_empty() {
            return none;
        }
        AdsConfig {
            provider: "adsense",
            client_id,
            banner_unit: build_env!("GOOGLE_ADSENSE_SLOT"),
            ..none
        }
    }

    // iOS no es objetivo: sin anuncios.
    #[cfg(target_os = "ios")]
    none
}
