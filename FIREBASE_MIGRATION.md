# Firebase security migration

## Current state

- The web client now loads Firebase Authentication and uses Email/Password sign-in.
- Passwords are no longer checked against `users/{name}/password` in Realtime Database.
- The browser session is restored only when Firebase Authentication has an active user and the locally cached profile matches that Firebase UID.
- Realtime Database rules remain deliberately deny-all in `database.rules.json`. This is a temporary lockdown, not the final application rules.
- `firebase.json` points Firebase CLI at that rules file.

## Required Firebase Console step

1. Open Firebase Console → Authentication → Sign-in method.
2. Enable **Email/Password** and save.
3. Keep Realtime Database rules deny-all until the per-user rules and data migration are complete.

## Important account migration limitation

Legacy Don accounts used nicknames and plaintext passwords stored in Realtime Database. Those records cannot be safely converted into Firebase Authentication accounts from this browser-only application, and the database is currently locked. Users will need to create/sign in to a Firebase Authentication account with an email address. Existing chats, profiles, and inventory are not automatically migrated by this first authentication change.

Do not reopen the database with public read/write rules to make the old login work. A trusted migration requires a privileged server/Admin SDK process or a controlled account recovery flow.

## Before restoring database access

The app still uses nickname-based paths throughout its data model (for example `users/{nickname}`, `userChats/{nickname}`, and `inventory/{nickname}`). A production ruleset must bind each nickname to the authenticated UID using a server-verified mapping, protect private profile fields, and enforce chat membership on both chat metadata and messages. Group administration must also be enforced in rules, not only in client-side UI checks.

Until that schema/rules migration is completed and tested, keep the deny-all rules published. Do not deploy permissive temporary rules.
