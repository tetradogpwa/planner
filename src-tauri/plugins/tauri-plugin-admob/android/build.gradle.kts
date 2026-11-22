import org.gradle.api.GradleException

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

// App ID de AdMob. Lo exporta tools/build.sh desde .env (o el CI).
//
// Si falta, el SDK de AdMob cierra la app al arrancar, así que antes se
// caía al App ID de prueba de Google. Eso convertía un APK publicable
// en una build con anuncios de prueba, sin avisar de nada. Ahora hace
// falta permiso explícito (ALLOW_NO_ADS=1), igual que en
// src-tauri/build.rs.
val googleTestAppId = "ca-app-pub-3940256099942544~3347511713"
val googleTestPrefix = "ca-app-pub-3940256099942544"

val allowNoAds = when (System.getenv("ALLOW_NO_ADS")?.trim()?.lowercase()) {
    "1", "true", "yes" -> true
    else -> false
}

val configuredAppId = System.getenv("GOOGLE_ADMOB_APP_ID")?.trim().orEmpty()

if (configuredAppId.isEmpty() && !allowNoAds) {
    throw GradleException(
        "Falta GOOGLE_ADMOB_APP_ID y no se ha permitido usar el App ID de prueba de " +
            "Google (ALLOW_NO_ADS=1). Un APK publicable necesita el App ID real de " +
            "AdMob: ponlo en .env (cp .env.example .env) o expórtalo antes de compilar."
    )
}

if (configuredAppId.startsWith(googleTestPrefix) && !allowNoAds) {
    throw GradleException(
        "GOOGLE_ADMOB_APP_ID es el App ID de prueba de Google ($googleTestAppId). Un " +
            "APK publicable no puede llevar anuncios de prueba: pon el App ID real de " +
            "AdMob en .env, o compila con ALLOW_NO_ADS=1 si es una build de pruebas."
    )
}

if (configuredAppId.isEmpty()) {
    println("ALLOW_NO_ADS=1: se usa el App ID de prueba de Google ($googleTestAppId); este APK lleva anuncios de prueba.")
}

val admobAppId: String = if (configuredAppId.isEmpty()) googleTestAppId else configuredAppId

android {
    namespace = "com.gabrielcat.admob"
    compileSdk = 35

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
        manifestPlaceholders["admobAppId"] = admobAppId
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.9.0")
    implementation("com.google.android.gms:play-services-ads:24.9.0")
    implementation(project(":tauri-android"))
}
