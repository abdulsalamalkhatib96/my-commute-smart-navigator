plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "com.mycommute.navigator"
    compileSdk = 37
    defaultConfig {
        applicationId = "com.mycommute.navigator"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.2.0-alpha"
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("com.mapbox.navigationcore:android-ndk27:3.33.1")
    implementation("com.mapbox.navigationcore:ui-maps:3.33.1")
}
