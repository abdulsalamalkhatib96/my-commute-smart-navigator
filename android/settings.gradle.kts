pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google(); mavenCentral()
        maven {
            url = uri("https://api.mapbox.com/downloads/v2/releases/maven")
            credentials {
                username = "mapbox"
                password = providers.gradleProperty("MAPBOX_DOWNLOADS_TOKEN").orElse(
                    providers.environmentVariable("MAPBOX_DOWNLOADS_TOKEN")
                ).orNull ?: ""
            }
            authentication { create<BasicAuthentication>("basic") }
        }
    }
}
rootProject.name = "MyCommuteNavigator"
include(":app")
