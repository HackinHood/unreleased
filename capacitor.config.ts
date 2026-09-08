import type { CapacitorConfig } from '@capacitor/cli'

// Native wrap of the web build, shared by the Android and iOS projects (see
// also electron/ for desktop). One renderer bundle serves web/desktop/mobile;
// nothing here should fork it. Platform checks in-app use Capacitor's injected
// globals, or lib/platform.ts for the WebView-capability forks.
//
// Origins differ per platform, and the audio path depends on it:
//   Android → https://localhost   (androidScheme default)
//   iOS     → capacitor://localhost (iosScheme default, pinned below)
// juicewrldapi.com answers with a wildcard `access-control-allow-origin: *`,
// which clears both, so the EQ chain's requirement (crossorigin="anonymous"
// audio, without which createMediaElementSource emits pure silence) holds on
// Android. It's moot on iOS, where lib/audioEffects.ts never builds the graph
// at all — but don't swap either scheme without rechecking audio on Android.
const config: CapacitorConfig = {
  appId: 'com.juicewrldapi.player',
  appName: 'Unreleased',
  webDir: 'dist',
  server: {
    // Pinned to Capacitor's current default rather than left implicit. The
    // scheme *is* the origin, and every bit of user state — settings, likes,
    // the auth token, cached playlists — is per-origin localStorage/IndexedDB.
    // A Capacitor upgrade that changed this default would silently orphan all
    // of it on already-installed builds, so the value is stated here where
    // changing it is a visible decision. For the same reason, do not "fix"
    // this to 'https' to match Android: it would sign every existing user out
    // and wipe their local data on update, for no gain.
    iosScheme: 'capacitor',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
