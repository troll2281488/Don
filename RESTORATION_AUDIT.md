# DonorGram restoration audit

Audit date: 2026-10-30

Repository scope: `troll2281488/Don` only.

## Baseline used

Compared the current default-branch `index.html` with the oldest commit returned by the repository's available commit search in this audit:

- Baseline commit: `589a962f2bb12f0721a72ff2f9cc6b537e349167`
- Baseline index blob: `29d0c7625cf21e76bfcac100d85cc1da9af0104d` (230,500 characters)
- Current index blob at audit time: `315d701941543068e13d884e33ea4f3d7483b0f0` (234,956 characters)

This is the oldest source snapshot surfaced by the available search, not proof that it is the first-ever DonorGram release.

## Verified feature presence

The following legacy feature entry points exist in both the baseline and current `index.html`. They should not be described as wholly missing or rebuilt from scratch:

| Area | Verified entry points |
|---|---|
| Direct messaging | `sendMessage`, `renderMessages`, `openChat`, `loadOlderMessages` |
| Contacts / discovery | `loadAllUsersForSearch`, `handleUserSearch`, `startChatWithUser` |
| Group chats | `createGroup`, `openChatManage`, `addMembersToChat`, `memberPromote`, `memberDemote`, `memberBan`, `memberUnban` |
| Calls | `startCall`, `listenIncoming`, `acceptIncoming`, `toggleVideoCam`, `switchCamera` |
| GPS / map | `gpsStartSharing`, `gpsStopSharing`, `gpsOpenMap`, `gpsLoadFriendsOnMap`, `gpsOpenSettings` |
| Wall / posts | `renderWallTab`, `renderWallList`, `publishWallPost`, `deleteChatNow` |
| Profile | `showProfile`, `openEditProfile`, `saveProfileEdits` |
| Inventory | `saveInventory`, `loadInventoryAndStart` |
| DonAI | `openDonAi`, `processDonAiMessage`, `askAiAboutMessage`, `openAiSettings` |
| Calculator link | `openCalculator`, `startCalcLinkRequestsListener`, `renderCalcLinkManager` |
| Notifications | `requestPushPermission`, `startNotificationWatcher`, `bindNotifSettings` |

Presence of a function name proves code presence only; it does not prove that its UI path, Firebase permissions, external services, or runtime behavior currently work.

## Confirmed blockers / incomplete rollout

1. Legacy browser login still uses the old Realtime Database credential path by default. The secure Firebase Auth bridge is opt-in and disabled by default.
2. The secure callable functions in `functions/index.js` are source-controlled but have not been deployed to Firebase project `donor-fd6ea`.
3. The additive `publicUsers` migration has not been run. User discovery through the secure profile API therefore must not be assumed ready.
4. The deployed Realtime Database rules previously supplied for this project authorize only `roomMembers` and `rtdb-media`. The legacy app's older paths (including users, inventory, userChats, messages, chats, typing, hidden, locations and calls) are not thereby authorized.
5. No broad root-level read/write rules should be added as a shortcut. GPS locations and private account data require narrow owner/consent/membership checks.
6. A GitHub commit does not deploy Cloud Functions, change Firebase Rules, or run the migration.

## Restoration priorities

- **P0 — make the app enter safely:** deploy and test the callable auth/session functions; verify Firebase Auth custom-token sign-in and server-side session revalidation with a disposable account; only then enable the secure-auth flag.
- **P0 — restore data access safely:** design/test path-specific RTDB rules for each legacy feature before enabling those features against production data.
- **P1 — verify messaging and groups end-to-end:** test chat list fanout, membership, message read/write, older-message pagination, pinned messages, typing and hidden-chat state.
- **P1 — verify calls:** test incoming/outgoing call signaling, permissions, audio/video negotiation, cleanup and reconnect behavior.
- **P1 — verify GPS:** test explicit sharing consent, owner-only writes, member-only reads, stop-sharing cleanup and map listeners.
- **P2 — verify profile, wall, inventory, DonAI, notifications and calculator-link workflows individually, including their backend dependencies.

## Important data-preservation constraints

- Do not delete or rewrite `users/{username}`, passwords, chats, messages, inventory, calls, or locations as part of an audit.
- Do not expose legacy plaintext passwords through public profile data.
- The public profile migration is additive and must be dry-run reviewed before `--apply`.
- Preserve the existing UI and data model while replacing unsafe access paths incrementally.

## Audit conclusion

The available historical source snapshot already contains the major feature entry points listed above, and the current source still contains them. The principal verified gap is not that all those screens/features were deleted; it is that their operational state against the currently deployed Firebase backend has not been proven, and the existing deployed rules block many legacy data paths. A true missing-feature list requires a known-good older release/archive or runtime test results. Do not label an existing-but-blocked feature as absent.
