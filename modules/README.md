# DonorGram modules

This folder contains isolated modules that are added alongside the existing
single-page application. The original interface in `index.html` remains the
main application entry point.

## Current modules

- `auth.js` — Firebase Authentication email/password operations. It requires
  the Firebase compat Auth SDK and is not yet wired into the existing login UI.

## Planned modules

- `donai.js` — authenticated requests to the DonAI server endpoint; no API key
  may be stored in browser code.
- `files.js` — file selection and safe upload helpers.
- `desktop.js` — desktop layout enhancements without changing the mobile UI.

Modules are integrated one at a time and tested against the existing app to
avoid breaking chat, calls, profiles, and stored user data.
