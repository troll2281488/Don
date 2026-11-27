# DonorGram calls migration from Zvonki

## Integration constraints

- DonorGram remains the identity provider and source of the signed-in user: `window.currentUser`.
- Calls use DonorGram's existing Firebase Realtime Database instance (`db`) and `calls/{callId}` records.
- Zvonki's Firebase project and separate account system are not copied.
- Existing audio/video call buttons in the private-chat header remain the primary entry point.
- The same web call module is used by the web app and Capacitor webview; native background-call behavior needs a separate Android implementation.

## Ported in this migration branch

- ICE candidate buffering until remote SDP is installed.
- Incoming-call listener cleanup to avoid duplicate listeners after app re-entry.
- Screen sharing in an active video call, using `getDisplayMedia` and `RTCRtpSender.replaceTrack`, with restoration to the camera when sharing ends.
- In-call quick reactions (thumbs-up, heart, laugh, applause) over the existing call record.
- Lightweight connection-quality display based on WebRTC stats (round-trip time and audio packet loss).
- Service-worker receiver for trusted `incoming_call` push payloads and notification click-to-open behavior.
- CI syntax validation for inline JavaScript in `index.html`.

## Still not ported / not production-ready

- Multi-participant group calling. Zvonki uses a peer-per-participant mesh and a separate `groupCalls` schema; Don's current engine is one-to-one. This needs a deliberate multi-peer refactor and UI, not a blind copy.
- Call history UI and Zvonki's profile/favorites/settings experience.
- Optional call recording. It must be explicit, visible to all participants, and consent-based; no background or hidden recording is added.
- All Zvonki traffic presets and detailed diagnostics beyond the basic WebRTC quality indicator.
- Camera switching/renegotiation parity across every browser/device.
- Reliable background incoming calls on Android: requires FCM setup, a trusted push sender/backend, native Android call UI/foreground service, and permissions.
- Web Push subscription registration and a trusted sender. A service worker cannot send its own push notifications.
- Real-world two-device audio/video, screen-share, and Android testing.

## Platform limitations

- `getDisplayMedia` availability depends on the browser and operating system; some mobile browsers and webviews do not support it.
- A closed browser cannot keep a live WebRTC microphone session alive. Push can notify and reopen the app, but it does not itself restore a live call.
- A powered-off phone cannot receive a live call.
- Do not add a separate Zvonki login or replace DonorGram's existing identity.

## Validation

- The branch includes an automated check for inline JavaScript syntax and the existing web asset build.
- CI and real two-device tests must pass before treating this migration as stable.
