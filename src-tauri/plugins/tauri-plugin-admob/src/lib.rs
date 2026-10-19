//! Plugin de Tauri que expone Google Mobile Ads (AdMob) al WebView.
//!
//! AdMob es un SDK nativo de Android: los anuncios se pintan como vistas
//! nativas encima del WebView, no como HTML. Este crate solo reenvía los
//! comandos a `AdmobPlugin.kt`. En escritorio los comandos devuelven
//! error; el frontend allí usa el adaptador de AdSense.
//!
//! JS: `invoke('plugin:admob|show_banner', { args: { adUnitId, position } })`

use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime,
};

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InitArgs {
    /// `false` → se piden anuncios no personalizados (`npa=1`).
    pub personalized: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BannerArgs {
    pub ad_unit_id: String,
    /// `"top"` o `"bottom"`.
    #[serde(default = "default_position")]
    pub position: String,
}

fn default_position() -> String {
    "bottom".into()
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterstitialArgs {
    pub ad_unit_id: String,
}

type Value = serde_json::Value;

#[cfg(target_os = "android")]
mod native {
    use super::Value;
    use serde::Serialize;
    use tauri::{plugin::PluginHandle, AppHandle, Manager, Runtime};

    pub struct Admob<R: Runtime>(pub PluginHandle<R>);

    pub async fn call<R: Runtime, P: Serialize>(
        app: &AppHandle<R>,
        method: &str,
        payload: P,
    ) -> Result<Value, String> {
        app.state::<Admob<R>>()
            .0
            .run_mobile_plugin_async(method, payload)
            .await
            .map_err(|e| e.to_string())
    }
}

#[cfg(not(target_os = "android"))]
mod native {
    use super::Value;
    use serde::Serialize;
    use tauri::{AppHandle, Runtime};

    pub async fn call<R: Runtime, P: Serialize>(
        _app: &AppHandle<R>,
        _method: &str,
        _payload: P,
    ) -> Result<Value, String> {
        Err("AdMob solo está disponible en Android".into())
    }
}

// Los nombres del segundo argumento son los métodos @Command de Kotlin.

#[tauri::command]
async fn initialize<R: Runtime>(app: AppHandle<R>, args: InitArgs) -> Result<Value, String> {
    native::call(&app, "initialize", args).await
}

/// Devuelve `{ height }` en px CSS para reservar hueco en la UI.
#[tauri::command]
async fn show_banner<R: Runtime>(app: AppHandle<R>, args: BannerArgs) -> Result<Value, String> {
    native::call(&app, "showBanner", args).await
}

#[tauri::command]
async fn hide_banner<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    native::call(&app, "hideBanner", ()).await
}

/// Carga y muestra un intersticial; resuelve cuando el usuario lo cierra.
#[tauri::command]
async fn show_interstitial<R: Runtime>(
    app: AppHandle<R>,
    args: InterstitialArgs,
) -> Result<Value, String> {
    native::call(&app, "showInterstitial", args).await
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("admob")
        .invoke_handler(tauri::generate_handler![
            initialize,
            show_banner,
            hide_banner,
            show_interstitial
        ])
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let handle = _api.register_android_plugin("com.gabrielcat.admob", "AdmobPlugin")?;
                _app.manage(native::Admob(handle));
            }
            Ok(())
        })
        .build()
}
