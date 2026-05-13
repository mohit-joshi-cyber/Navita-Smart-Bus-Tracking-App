# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Capacitor Firebase Authentication - Facebook (Optional dependencies)
-dontwarn com.facebook.**

# Capacitor Firebase Authentication - Twitter (Optional dependencies)
-dontwarn com.twitter.sdk.android.core.**

# Capacitor Firebase Authentication - GitHub (Optional dependencies)
-dontwarn com.google.firebase.auth.GithubAuthProvider

# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.** { *; }

# Keep your custom MainActivity and other app classes if needed
-keep class com.navita.app.** { *; }

# Firebase-related keeps (often handled by Firebase SDK, but good to have)
-keep class com.google.firebase.** { *; }

# Proguard rules for Capacitor plugins
-keep class io.capawesome.capacitorjs.plugins.** { *; }
