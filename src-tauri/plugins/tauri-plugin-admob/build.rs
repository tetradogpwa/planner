const COMMANDS: &[&str] = &["initialize", "show_banner", "hide_banner", "show_interstitial"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
