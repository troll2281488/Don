# Legacy Realtime Database access inventory

Reviewed against the current original `index.html`. This is a working inventory for designing rules and migration; it is not a replacement ruleset.

## Confirmed paths and operations

| Path | Observed operations | Data / security concern |
|---|---|---|
| `users/{uid}` | read, write, realtime listener | Profile, presence, password, blocked state, GPS preference. Contains legacy plaintext password; never expose collection reads. |
| `users` | full collection read | Used by user search and GPS friend map. Must be replaced by a sanitized public directory or a server-mediated lookup. |
| `inventory/{uid}` | read, write, realtime listener | Private balance, owned items, settings. Owner-only. |
| `userChats/{uid}` | read, write, listeners, multi-location updates | Per-user chat index, unread counts, last-message previews. Owner-only; writes may be initiated by another participant to update unread/preview metadata. |
| `messages/{chatId}` | read, create, update, delete, listener | Private chat content/media. Access must be based on verified chat membership; sender identity and mutation constraints need validation. |
| `chats/{chatId}` | read/write child fields | Group metadata, admins and banned members. Membership/admin authorization required. |
| `typing/{chatId}/{uid}` | write/remove | Ephemeral presence; only the authenticated owner should write their own typing node; readers must be chat members. |
| `hidden/{uid}/{chatId}` | read/write | Per-user hidden-message state. Owner-only. |
| `locations/{uid}` | read/write | Sensitive precise location. Owner writes; reads only with explicit sharing and appropriate relationship/consent. |
| `calls` | query/listen/create/update | Call signaling contains participant identifiers and connection data. Must be restricted to caller/callee. |
| `roomMembers/{roomId}/{uid}` | already governed by supplied rules | Existing authenticated per-user membership marker. |
| `rtdb-media/rooms/{roomId}/{ownerUid}/{fileId}` | already governed by supplied rules | Existing room media rules; preserve while changing unrelated branches. |

## Important multi-user write behavior

The current message sender performs a root-level multi-location update after writing a message. It updates `userChats/{participantUid}/{chatId}/unreadCount`, `lastMessage` and `lastMessageTime` for every participant, including the other user's node. Therefore a simple owner-only write rule on all of `userChats/{uid}` will break message delivery previews/unread counts. This must be moved to a trusted server trigger or redesigned as narrowly validated participant writes.

## Migration constraints

1. Do not add a broad root `.read` or `.write`.
2. Do not permit any client to read `users/{uid}/password` or the full `users` collection.
3. Keep existing usernames/UID mapping unchanged.
4. Copy public fields to a separate public profile index before restricting the private user records. Preserve original data until migration is verified.
5. Prefer server-side message fan-out for other participants' unread/preview updates.
6. Keep the existing `roomMembers` and `rtdb-media` rule behavior intact.
7. Build and test rules against a backup and disposable accounts before applying them to production.

## Next implementation tasks

- Deploy the sanitized user-directory/search, single-profile and batch-profile endpoints; migrate `publicUsers`; then switch `loadAllUsersForSearch` and GPS friend lookup away from whole-collection reads.
- Switch profile editing to `updateLegacyProfile` only after the callable is deployed and tested against a disposable account.
- Design a safe profile read/update API for profile subscriptions and edits.
- Move cross-user chat index fan-out to a trusted server trigger.
- Add membership-aware rules for private/group messages and call signaling.
- Only after those pieces are deployed, connect the login UI to `signInLegacyAccount` and restore sessions with Firebase Auth.


## Current client integration status (2026-10-30)

The source now includes callable helpers for legacy sign-in, session revalidation, public-profile search, single/batch profile reads, and constrained profile updates. The secure auth/profile flags in the page remain disabled by default. These callable endpoints are source code only until deployed.

The old client still directly accesses the legacy paths listed above. In particular:
- `loadData()` subscribes to `userChats/{uid}`, `inventory/{uid}`, `users/{uid}/blockedUsers`, and `users/{uid}/gpsSharing`.
- `subscribeToUser()` still subscribes to `users/{otherUid}` unless the secure profile flag is enabled.
- `sendMessage()` and group-management operations issue client-side writes to messages, chat metadata, and per-user chat indexes.
- `setupPresence()` writes `users/{uid}/status` and configures on-disconnect behavior.
- `gpsStartSharing()` writes `locations/{uid}` and `users/{uid}/gpsSharing`.
- Call signaling uses the legacy `calls` branch.

These are explicit blockers for a secure-auth-only rollout: authentication does not grant database access, and callable profile APIs do not replace the other realtime listeners/writes.

## Safe next migration boundary

Do not publish a replacement rules file until every multi-user write is either moved behind a trusted backend or constrained by a tested membership/participant rule. In particular, the current client-side unread-count/last-message fan-out prevents a blanket owner-only `userChats/{uid}` rule. Preserve existing `roomMembers` and `rtdb-media` behavior. The next safe implementation unit is server-side chat-index fan-out plus message membership validation, followed by emulator tests and a narrowly scoped ruleset.
