# DonorGram Android build

The Android app is packaged with Capacitor. The existing `index.html` is copied into the APK as a local asset; it is not loaded from GitHub Pages at launch.

## Build on GitHub

1. Open the repository's **Actions** tab.
2. Select **Android APK**.
3. Tap **Run workflow** (or push a change to `index.html`).
4. Open the completed run and download the `DonorGram-debug-apk` artifact.
5. Extract the ZIP and install `app-debug.apk` on Android.

## Offline notes

Firebase compatibility scripts, Leaflet, and Font Awesome are bundled locally so the app shell does not need their CDNs to start. Firebase Realtime Database persistence is enabled when supported by the WebView.

Network access is still required for live Firebase synchronization, AI services, map tiles, and remote media not already cached. This first APK build is a debug build for testing, not a signed Play Store release.
