plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

// App ID de AdMob. Lo exporta tools/build-android.sh desde .env.
// Si falta se usa el App ID de prueba de Google: sin él el SDK cierra
// la app al arrancar.
val admobAppId: String = System.getenv("GOOGLE_ADMOB_APP_ID")
    ?.takeIf { it.isNotBlank() }
    ?: "ca-app-pub-3940256099942544~3347511713"

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
    implementation("com.google.android.gms:play-services-ads:23.6.0")
    implementation(project(":tauri-android"))
}
