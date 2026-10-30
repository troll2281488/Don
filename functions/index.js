"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");

initializeApp();

function normalizeUsername(value) {
  return String(value || "").trim();
}

/**
 * Temporary bridge for legacy DonorGram accounts.
 * The old password is checked only on the trusted server. The function then
 * issues a Firebase custom token whose UID is the unchanged legacy username.
 *
 * IMPORTANT: deploy only after reviewing the legacy RTDB data and configuring
 * rate limiting / App Check. Do not expose users/{username} with public rules.
 */
exports.signInLegacyAccount = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    const username = normalizeUsername(request.data && request.data.username);
    const password = String(request.data && request.data.password || "");

    if (!username || username.length > 128 || /[.#$\[\]/]/.test(username) || !password || password.length > 256) {
      throw new HttpsError("invalid-argument", "Проверьте имя пользователя и пароль.");
    }

    const snapshot = await getDatabase().ref("users/" + username).get();
    if (!snapshot.exists()) {
      // Keep the same response for unknown users and wrong passwords.
      throw new HttpsError("unauthenticated", "Неверный ник или пароль.");
    }

    const user = snapshot.val() || {};
    if (user.blocked === true) {
      throw new HttpsError("permission-denied", "Аккаунт заблокирован.");
    }
    if (typeof user.password !== "string" || user.password !== password) {
      throw new HttpsError("unauthenticated", "Неверный ник или пароль.");
    }

    // Existing Firebase UID is preserved if this account was migrated before.
    try {
      await getAuth().getUser(username);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    const token = await getAuth().createCustomToken(username, {
      legacyAccount: true,
      legacyUsername: username
    });

    return {
      token,
      uid: username,
      username,
      profile: {
        name: user.name || username,
        avatar: user.avatar || username.substring(0, 2).toUpperCase(),
        avatarUrl: user.avatarUrl || null,
        bio: user.bio || ""
      }
    };
  }
);
