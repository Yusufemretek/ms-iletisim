# Keep Capacitor runtime classes
-keep class com.getcapacitor.** { *; }
-keep class com.msiletisim.app.** { *; }

# Preserve WebView and JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep line numbers for debugging
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# OkHttp (used by Supabase client)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# Keep Supabase/JSON models
-keep class com.supabase.** { *; }
-keep class io.github.jan.supabase.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep Kotlin metadata
-keep class kotlin.Metadata { *; }
