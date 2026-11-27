# DonorGram calls migration from Zvonki

## Integration constraints

- DonorGram remains the identity provider and source of the signed-in user: `window.currentUser`.
- Calls must use DonorGram's existing Firebase Realtime Database instance (`db`) and its `calls/{callId}` records.
- Do not copy Zvonki's Firebase project configuration or ask DonorGram users to register again.
- The existing audio/video call buttons in the private-chat header remain the primary entry point.

## Source review

The Zvonki repository contains a standalone call console with WebRTC audio/video, group-call signaling, camera controls, screen sharing, ICE restart, call diagnostics, traffic presets, call history, reactions, and optional local recording. Its UI and data model are coupled to Zvonki's own user model, Firebase project, and DOM IDs, so copying its page wholesale would break DonorGram's existing chat and authentication.

DonorGram already has a separate one-to-one WebRTC implementation and call UI. The migration therefore needs to port compatible call-engine behaviors into that implementation rather than replace the messenger shell.

## Included in this branch

- Buffer incoming ICE candidates until the remote SDP description is installed, then flush the queue. This avoids losing candidates that arrive before the offer/answer.
- Reuse one Firebase incoming-call listener and detach the previous callback before registering a new one, avoiding duplicate listeners after repeated app starts.
- Add a service-worker push display handler for trusted `incoming_call` push payloads and focus/open DonorGram when the notification is tapped.

## Important background-call limitation

A web page cannot guarantee that an active WebRTC call survives the browser being closed, the operating system suspending the browser, or the phone being powered off. A service worker can display a push notification, but it cannot keep a microphone stream or peer connection alive.

Reliable incoming-call wake-up requires a real push sender and subscription lifecycle (VAPID/Web Push for supported browsers, or FCM for Android), plus native Android call/foreground-service integration for dependable background operation. The repository currently has no push subscription registration, VAPID public key, trusted push-sending backend, or tracked native Android project. The service-worker handler in this branch is only the receiving/display side; it does not by itself make calls ring while the site is closed.

## Remaining Zvonki features to port and verify

- Group calls and multi-peer signaling.
- Screen sharing and camera switching/renegotiation.
- Network diagnostics, traffic presets, and robust ICE restart.
- Call history, reactions, and optional local recording.
- Native incoming-call experience and background audio for the Android package.

These features must be adapted to DonorGram's existing user/chat model and tested with two real devices before being described as complete.
