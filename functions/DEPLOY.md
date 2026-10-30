# Legacy DonorGram authentication rollout

This directory contains the server-side bridge for the original `users/{username}` accounts.

## Current status

- `signInLegacyAccount` verifies the legacy password on the server and issues a Firebase custom token.
- `searchLegacyUsers` returns a limited, sanitized user-search result and requires that legacy Firebase Auth session.\n- `getLegacyPublicProfile` returns one sanitized public profile to an authenticated legacy session.\n- `getLegacyPublicProfiles` returns up to 50 sanitized profiles for friend/map views.\n- `updateLegacyProfile` allows an authenticated user to change only name, avatar, bio and an HTTPS avatar URL; it synchronizes `users/{uid}` and `publicUsers/{uid}` without accepting password or private fields.
- The functions are **not deployed** by a GitHub commit. The public-profile migration has not been run.
- The original browser login has **not** been switched to this function.
- Existing Realtime Database rules do not authorize the legacy app's data paths.

## Why the browser login is not switched on yet

The current `index.html` does much more than read a single user's profile. It also:

- reads the entire `users` collection for user search and map features;
- reads/writes `users/{uid}`, including profile, presence, blocking and GPS settings;
- reads/writes `inventory/{uid}`;
- reads/writes `userChats/{uid}`, `messages/{chatId}`, `chats/{chatId}`, `locations/{uid}` and `calls`.

The deployed rules currently authorize only `roomMembers` and `rtdb-media`. Enabling the callable login alone would authenticate the browser but would not restore these reads/writes. Granting broad read/write access to make the UI appear to work would expose account records (including legacy plaintext passwords) and private messages.

## Required rollout sequence

1. Deploy this callable function to project `donor-fd6ea` in `europe-west1`.
2. Migrate private credentials out of the public/profile data model. Do not make `users/{username}` readable to all signed-in users while it contains `password`.
3. Run the additive `functions/migrate-public-users.js` script in dry-run mode, review the count, then run with `--apply` using trusted Application Default Credentials. This copies only sanitized fields to `publicUsers/{uid}` and does not delete or modify source records.
4. Define and test ownership/membership rules for inventory, user chats, messages, group chats, locations and calls against the exact existing data shape.
5. Only then switch the old login UI to callable + `signInWithCustomToken`, and restore sessions using Firebase Auth state rather than trusting `localStorage` alone.
6. Test with a disposable account and a backup before applying any data migration to real accounts.

## Deploy

From the repository root, after installing Firebase CLI and selecting the correct Google account:

```sh
cd functions
npm install
node migrate-public-users.js   # dry-run; requires ADC
node migrate-public-users.js --apply   # writes publicUsers only
cd ..
firebase use donor-fd6ea
firebase deploy --only functions:signInLegacyAccount,functions:searchLegacyUsers,functions:getLegacyPublicProfile,functions:getLegacyPublicProfiles,functions:updateLegacyProfile
```

The Firebase project may require the Blaze billing plan for Cloud Functions. Review the function's rate limiting and enable App Check before production use. The current callable has App Check enforcement disabled for initial integration; do not treat that as production hardening.

**Do not deploy permissive Realtime Database rules as a workaround.**


## Opt-in Firebase Auth UI bridge

The old login screen now has a guarded integration with `DonorGramAuth.signInLegacy`, and cached-session restoration waits for Firebase Auth's first `onAuthStateChanged` event before trusting the cached UID. Both are disabled by default. To test only after deploying the callable functions and confirming the required RTDB rules and public profile migration, set `window.DG_SECURE_AUTH_ENABLED = true` before the main application script runs. Keep it disabled during rollout: GitHub commits do not deploy Cloud Functions or change RTDB Rules. Existing account creation remains on the legacy path; the callable bridge currently authenticates existing legacy accounts only. Do not enable until the backend is deployed and tested against a non-production account.
