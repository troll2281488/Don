# DonorGram offline / AI add-on

This branch adds a progressive-enhancement module without rewriting the existing chat app.

- IndexedDB cache for messages loaded on device, plus durable outgoing queue while offline.
- Queue replay when connectivity returns and the authenticated session is active.
- Local search over cached message history.
- DonorGram AI panel: TXT/code local reading; PDF via pdf.js and DOCX via JSZip loaded on demand; document analysis and coding help through OpenAI-compatible chat completions.
- User-supplied API endpoint/model/key. Key is not embedded in code or saved to localStorage.
- Web Speech API transcription where supported; local calculator and notes mini-tools; explicit notification permission request.
- Existing Firebase chats, voice notes and WebRTC call code are not replaced.

## Limits to verify before production
- IndexedDB is the cross-platform browser store, not SQLite. Native SQLite should be added only after validating Capacitor's generated Android lifecycle and plugin sync.
- Offline history is available after a chat has been loaded on that device. First login/sync needs internet.
- Queued text/media is persisted and replayed on reconnect; test Firebase rules, retries and duplicate prevention before production.
- AI needs a compatible endpoint and user key, or reachable local Ollama. Document parser libraries are downloaded on first PDF/DOCX use.
- Speech recognition, push notifications, background execution, camera/microphone and WebRTC depend on platform permissions and WebView support. This module does not claim native background push or guaranteed background execution.
