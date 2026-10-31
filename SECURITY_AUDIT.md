# Don security audit and required migration

Audit date: 2026-11-01
Repository: https://github.com/troll2281488/Don

## Findings from the public client source

### Critical: the current account system is not authentication
`index.html` implements sign-in by reading `users/{name}` from Realtime Database and comparing a client-supplied password with `users/{name}/password`. Registration writes that password directly to the database. Profile editing can update the same field.

Consequences:
- If Realtime Database rules permit public reads, account passwords and profile data can be read by anyone.
- A copied client can call the same database directly; hiding or obfuscating the Firebase web config does not stop it.
- The client-side `currentUser.id` is not a trustworthy identity. It is user-controlled state.
- UI checks, group `admins` fields, block flags, balances and inventory are not security boundaries.

### Critical: user enumeration
The client reads the entire `users` collection in `loadAllUsersForSearch()`. This means the current design expects broad user-directory reads. Do not publish a deny-all or authenticated-only rule without first replacing this design and migrating authentication.

### High: TURN credentials were committed to the public client
Static Metered TURN credentials were present in `index.html`. They have been removed from the current version of the file in commit `f26a45748ddf871820d6d4d276665dd9a6fc5904`. Calls temporarily use public STUN servers only, so calls behind restrictive NATs may fail more often.

**Removing credentials from the latest file does not revoke them or erase them from Git history. Rotate/revoke the exposed TURN credentials in the Metered dashboard immediately.** Issue new short-lived credentials from a server-side endpoint; never put permanent TURN credentials in browser code.

### Firebase web configuration
The Firebase web config in `index.html` is public client configuration, not an administrator credential. It cannot be made secret while the browser connects directly to Firebase. Protect the project with Authentication, Security Rules, App Check, quota/monitoring and API restrictions where appropriate.

### No server-side admin authority found
The current client uses ordinary Realtime Database reads/writes and does not load Firebase Authentication. Group admin flags are stored in client-readable/writable chat data and are only used for UI behaviour. They must not be treated as global Don administrator privileges.

## Required migration — do not skip steps

1. **Preserve a backup** of Realtime Database before changing rules or migrating accounts.
2. **Enable Firebase Authentication** (Email/Password or another supported provider) in Firebase Console.
3. Build a trusted migration path for existing accounts. Do not copy plaintext passwords into Firebase Auth from client code. Because existing passwords are stored in Realtime Database, plan a secure password-reset/re-registration flow. Remove legacy `users/{name}/password` fields after migration.
4. Replace the app's custom `currentUser` login with Firebase Auth sessions. Derive the user ID only from `firebase.auth().currentUser.uid` / verified ID tokens, never from a text field or localStorage.
5. Replace public `users` directory reads with a limited public profile index containing only safe fields (for example display name and avatar). Keep private account fields in a separate per-user path.
6. Implement Security Rules based on authenticated UID. Validate every write, prevent clients from changing roles, balances, ownership, moderation state and other privileged fields. Restrict chat reads/writes to actual participants.
7. Assign the Don owner/admin role only with Firebase Admin SDK in a trusted server environment (Cloud Functions/Cloud Run). Use custom claims and verify them in rules and server endpoints. Never let the client write its own role.
8. Enable and enforce Firebase App Check for supported products after validating the production app.
9. Put paid AI, moderation, admin and TURN credential issuance behind server endpoints. Store secrets in the server's secret manager, add per-user quotas and rate limits.
10. Test with two ordinary accounts and one owner account: cross-user profile reads, private chat access, forged UID, forged admin role, balance changes, group membership changes, and unauthenticated REST requests must all be denied as appropriate.

## Important: why rules are not deployed from this repository

This app currently has no Firebase Authentication integration and relies on unauthenticated Realtime Database access plus client-controlled identity. Applying restrictive rules now would likely break sign-in, registration, messaging, search, presence and other features. No Firebase Console access or current deployed Rules document is available from this repository connection. Therefore this audit deliberately does **not** publish guessed rules or claim that the live database is secured.

Before production rules can be safely written, export/inspect the current Realtime Database Rules and map all database paths and operations. Never use `.read: true` or `.write: true` as a workaround.

## Owner actions outside GitHub

- In Metered dashboard, revoke/rotate the exposed TURN username/credential immediately.
- In Firebase Console, inspect Realtime Database → Rules and take a database backup.
- Inspect Firebase Authentication → Users and enable a supported sign-in provider for the migration.
- Inspect App Check and usage/billing alerts.
- If any actual service-account private key or other server secret was ever committed, revoke it and issue a replacement. Do not paste secrets into chat or GitHub issues.
