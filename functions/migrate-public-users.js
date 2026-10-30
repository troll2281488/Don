"use strict";

// One-time, additive migration: users/{uid} -> publicUsers/{uid}.
// Default mode is dry-run. Run with --apply to write sanitized public fields.
// Requires trusted Application Default Credentials; never commit service-account keys.

const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

function cleanProfile(uid, value) {
  const user = value && typeof value === "object" ? value : {};
  if (user.blocked === true) return null;
  const name = String(user.name || uid).slice(0, 128);
  const profile = {
    id: uid,
    name,
    avatar: String(user.avatar || name.slice(0, 1).toUpperCase()).slice(0, 8),
    bio: typeof user.bio === "string" ? user.bio.slice(0, 160) : "",
    status: user.status === "online" ? "online" : "offline"
  };
  if (typeof user.avatarUrl === "string" && user.avatarUrl.length <= 2048) {
    profile.avatarUrl = user.avatarUrl;
  }
  return profile;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDatabase();
  const snapshot = await db.ref("users").get();
  const users = snapshot.val() || {};
  const updates = {};
  let count = 0;

  for (const [uid, value] of Object.entries(users)) {
    if (!uid || /[.#$\[\]/]/.test(uid)) continue;
    const profile = cleanProfile(uid, value);
    if (!profile) continue;
    updates["publicUsers/" + uid] = profile;
    count += 1;
  }

  console.log((apply ? "APPLY" : "DRY RUN") + ": " + count + " public profiles prepared.");
  console.log("No source records are deleted or modified.");
  if (apply && count) {
    await db.ref().update(updates);
    console.log("Sanitized public profile index written.");
  } else if (!apply) {
    console.log("Review the count, then rerun with --apply to write.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
