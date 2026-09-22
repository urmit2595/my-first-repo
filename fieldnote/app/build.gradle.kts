import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Machine-local values, never committed: telemetry endpoint and key, signing keystore and passwords (see README).
val local = Properties().apply { rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) } }
fun localProp(k: String, d: String = "") = local.getProperty(k, d)

android {
    namespace = "com.urmit.glasses.dev"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.urmit.glasses.dev"
        minSdk = 31
        targetSdk = 34
        versionCode = 310
        versionName = "3.1"
        // Meta Developer Mode placeholders. Replace with the registered values for a production build.
        buildConfigField("String", "DIAG_ENDPOINT", "\"${localProp("fieldnote.diagEndpoint")}\"")
        buildConfigField("String", "DIAG_KEY", "\"${localProp("fieldnote.diagKey")}\"")
        manifestPlaceholders["mwdat_application_id"] = "0"
        manifestPlaceholders["mwdat_client_token"] = "0"
        ndk { abiFilters += listOf("arm64-v8a") }   // Nothing Phone is arm64; drops ~25 MB of other-ABI native libs
    }
    signingConfigs {
        create("release") {
            // The same key must sign every build, or it won't install over the previous one.
            storeFile = file(localProp("fieldnote.keystore", "../fieldnote.keystore"))
            storePassword = localProp("fieldnote.storePassword"); keyAlias = localProp("fieldnote.keyAlias", "fieldnote"); keyPassword = localProp("fieldnote.keyPassword")
        }
    }
    buildTypes { release { isMinifyEnabled = true; isShrinkResources = true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"); signingConfig = signingConfigs.getByName("release") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    packaging { resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "META-INF/DEPENDENCIES") }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-service:2.8.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.media:media:1.7.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-video:2.7.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.meta.wearable:mwdat-core:0.9.0")
    implementation("com.meta.wearable:mwdat-camera:0.9.0")
}
