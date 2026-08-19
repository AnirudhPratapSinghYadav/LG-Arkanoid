# R8 rules for the LG Arkanoid controller.
#
# Flutter's own Gradle plugin already contributes rules for the engine, and most
# plugins ship consumer rules inside their AARs. What is listed here are the
# cases R8 cannot see statically: classes reached only through reflection or JNI.

# --- Flutter engine / embedding ------------------------------------------------
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**
# Play Core split-install is not used; R8 still sees Flutter's optional
# FlutterPlayStoreSplitApplication reference and fails minify without this.
-dontwarn com.google.android.play.core.splitcompat.SplitCompatApplication
-dontwarn com.google.android.play.core.**

# --- mobile_scanner (ML Kit barcode) -----------------------------------------
# ML Kit loads its detector implementations reflectively at runtime. Without
# these keeps the QR join-code scanner throws at first use in a release build.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.mlkit.**
# The optional bundled-model variants are not shipped in this APK; the scanner
# uses the Play-services model, so silence the unresolved references.
-dontwarn com.google.mlkit.vision.barcode.bundled.**

# --- flutter_secure_storage (Android Keystore) --------------------------------
-keep class androidx.security.crypto.** { *; }
-dontwarn androidx.security.crypto.**

# --- flutter_tts --------------------------------------------------------------
-keep class android.speech.tts.** { *; }
-dontwarn android.speech.tts.**

# --- Kotlin coroutines / metadata --------------------------------------------
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlinx.coroutines.**
-keep class kotlin.Metadata { *; }

# --- dartssh2 / JNI (SSH to the rig) -----------------------------------------
-keep class com.github.dart_lang.jni.** { *; }
-dontwarn com.github.dart_lang.jni.**

# Keep annotations so the above keeps are honoured.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
