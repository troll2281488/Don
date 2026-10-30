"use strict";

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");

initializeApp();

function normalizeUsername(value) {
  return String(value || "").trim();
}

function rateLimitKey(ip, username) {
  return crypto.createHash("sha256")
    .update(String(ip || "unknown") + "|" + String(username || "").toLowerCase())
    .digest("hex");
}

async function checkLegacyLoginLimit(ip, username) {
  const ref = getDatabase().ref("internalAuthRateLimits/" + rateLimitKey(ip, username));
  const now = Date.now();
  const result = await ref.transaction((current) => {
    const state = current && typeof current === "object" ? current : {};
    if (Number(state.resetAt || 0) <= now) {
      return { count: 0, resetAt: now + 15 * 60 * 1000 };
    }
    return state;
  });
  const state = result.snapshot.val() || {};
  if (Number(state.count || 0) >= 5) {
    throw new HttpsError("resource-exhausted", "Слишком много попыток. Попробуйте позже.");
  }
  return ref;
}

async function recordLegacyLoginFailure(ref) {
  const now = Date.now();
  await ref.transaction((current) => {
    const state = current && typeof current === "object" ? current : {};
    if (Number(state.resetAt || 0) <= now) {
      return { count: 1, resetAt: now + 15 * 60 * 1000 };
    }
    return { count: Number(state.count || 0) + 1, resetAt: Number(state.resetAt) };
  });
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

    const requestIp = request.rawRequest && request.rawRequest.ip || "unknown";
    const rateLimitRef = await checkLegacyLoginLimit(requestIp, username);
    const snapshot = await getDatabase().ref("users/" + username).get();
    if (!snapshot.exists()) {
      await recordLegacyLoginFailure(rateLimitRef);
      throw new HttpsError("unauthenticated", "Неверный ник или пароль.");
    }

    const user = snapshot.val() || {};
    if (user.blocked === true) {
      throw new HttpsError("permission-denied", "Аккаунт заблокирован.");
    }
    if (typeof user.password !== "string" || user.password !== password) {
      await recordLegacyLoginFailure(rateLimitRef);
      throw new HttpsError("unauthenticated", "Неверный ник или пароль.");
    }
    await rateLimitRef.remove();

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


/**
 * Revalidates the current legacy Firebase Auth session against the private
 * account record. This prevents a cached browser profile from keeping a
 * blocked/deleted account signed in after token restoration.
 */
exports.getLegacySessionProfile = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    if (!request.auth || request.auth.token.legacyAccount !== true) {
      throw new HttpsError("unauthenticated", "Требуется вход в аккаунт.");
    }
    const uid = request.auth.uid;
    if (!uid || uid.length > 128 || [".", "#", "$", "[", "]", "/"].some((ch) => uid.includes(ch))) {
      throw new HttpsError("unauthenticated", "Недействительная сессия.");
    }
    const snapshot = await getDatabase().ref("users/" + uid).get();
    if (!snapshot.exists()) throw new HttpsError("unauthenticated", "Аккаунт больше не существует.");
    const user = snapshot.val() || {};
    if (user.blocked === true) throw new HttpsError("permission-denied", "Аккаунт заблокирован.");
    return {
      uid,
      profile: {
        id: uid,
        name: String(user.name || uid).slice(0, 128),
        avatar: String(user.avatar || uid.substring(0, 1).toUpperCase()).slice(0, 8),
        avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl.slice(0, 2048) : null,
        bio: typeof user.bio === "string" ? user.bio.slice(0, 160) : ""
      }
    };
  }
);


/**
 * Returns a sanitized directory for the legacy user-search UI.
 * Requires a Firebase Auth session created by the legacy sign-in bridge.
 * Never returns password or other private account fields.
 */
exports.searchLegacyUsers = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    if (!request.auth || request.auth.token.legacyAccount !== true) {
      throw new HttpsError("unauthenticated", "Требуется вход в аккаунт.");
    }

    const query = String(request.data && request.data.query || "").trim().toLowerCase().slice(0, 64);
    if (!query) return { users: [] };

    const snapshot = await getDatabase().ref("publicUsers").get();
    const all = snapshot.val() || {};
    const users = [];

    for (const [uid, value] of Object.entries(all)) {
      if (uid === request.auth.uid || !value || value.blocked === true) continue;
      const name = String(value.name || uid);
      if (name.toLowerCase().includes(query) || uid.toLowerCase().includes(query)) {
        users.push({
          id: uid,
          name,
          avatar: String(value.avatar || name.substring(0, 1).toUpperCase()).slice(0, 8),
          avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl.slice(0, 2048) : null,
          bio: typeof value.bio === "string" ? value.bio.slice(0, 160) : "",
          status: value.status === "online" ? "online" : "offline"
        });
        if (users.length >= 30) break;
      }
    }

    return { users };
  }
);


/**
 * Fetch one sanitized public profile for the legacy profile/chat UI.
 * The caller must be signed in through the legacy custom-token bridge.
 */
exports.getLegacyPublicProfile = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    if (!request.auth || request.auth.token.legacyAccount !== true) {
      throw new HttpsError("unauthenticated", "Требуется вход в аккаунт.");
    }

    const uid = String(request.data && request.data.uid || "").trim();
    if (!uid || uid.length > 128 || /[.#$\[\]/]/.test(uid)) {
      throw new HttpsError("invalid-argument", "Некорректный идентификатор пользователя.");
    }

    const snapshot = await getDatabase().ref("publicUsers/" + uid).get();
    if (!snapshot.exists()) return { profile: null };

    const value = snapshot.val() || {};
    if (value.blocked === true) return { profile: null };
    const name = String(value.name || uid).slice(0, 128);
    return {
      profile: {
        id: uid,
        name,
        avatar: String(value.avatar || name.substring(0, 1).toUpperCase()).slice(0, 8),
        avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl.slice(0, 2048) : null,
        bio: typeof value.bio === "string" ? value.bio.slice(0, 160) : "",
        status: value.status === "online" ? "online" : "offline"
      }
    };
  }
);

/**
 * Fetch a bounded batch of sanitized public profiles for friend/map views.
 * Only authenticated legacy accounts can call this endpoint.
 */
exports.getLegacyPublicProfiles = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    if (!request.auth || request.auth.token.legacyAccount !== true) {
      throw new HttpsError("unauthenticated", "Требуется вход в аккаунт.");
    }
    const requested = request.data && request.data.uids;
    if (!Array.isArray(requested)) {
      throw new HttpsError("invalid-argument", "Ожидается список пользователей.");
    }
    const uids = [...new Set(requested.map((uid) => String(uid || "").trim()).filter(
      (uid) => uid && uid.length <= 128 && ![".", "#", "$", "[", "]", "/"].some((ch) => uid.includes(ch))
    ))].slice(0, 50);
    const profiles = {};
    await Promise.all(uids.map(async (uid) => {
      const snap = await getDatabase().ref("publicUsers/" + uid).get();
      if (!snap.exists()) return;
      const value = snap.val() || {};
      if (value.blocked === true) return;
      const name = String(value.name || uid).slice(0, 128);
      profiles[uid] = {
        id: uid,
        name,
        avatar: String(value.avatar || name.substring(0, 1).toUpperCase()).slice(0, 8),
        avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl.slice(0, 2048) : null,
        bio: typeof value.bio === "string" ? value.bio.slice(0, 160) : "",
        status: value.status === "online" ? "online" : "offline"
      };
    }));
    return { profiles };
  }
);


/**
 * Update only public profile fields for the currently authenticated legacy user.
 * Password, block state, inventory, presence and private settings are not accepted.
 */
exports.updateLegacyProfile = onCall(
  { region: "europe-west1", enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    if (!request.auth || request.auth.token.legacyAccount !== true) {
      throw new HttpsError("unauthenticated", "Требуется вход в аккаунт.");
    }
    const uid = request.auth.uid;
    const input = request.data && request.data.profile || {};
    const allowed = {};
    if (Object.prototype.hasOwnProperty.call(input, "name")) {
      const name = String(input.name || "").trim().slice(0, 128);
      if (!name) throw new HttpsError("invalid-argument", "Имя не может быть пустым.");
      allowed.name = name;
    }
    if (Object.prototype.hasOwnProperty.call(input, "avatar")) {
      allowed.avatar = String(input.avatar || "").trim().slice(0, 8);
    }
    if (Object.prototype.hasOwnProperty.call(input, "bio")) {
      allowed.bio = String(input.bio || "").slice(0, 160);
    }
    if (Object.prototype.hasOwnProperty.call(input, "avatarUrl")) {
      const avatarUrl = input.avatarUrl;
      if (avatarUrl === null || avatarUrl === "") {
        allowed.avatarUrl = null;
      } else if (typeof avatarUrl === "string" && avatarUrl.length <= 2048 && /^https:\/\//i.test(avatarUrl)) {
        allowed.avatarUrl = avatarUrl;
      } else {
        throw new HttpsError("invalid-argument", "Некорректная ссылка аватара.");
      }
    }
    if (!Object.keys(allowed).length) return { ok: true };
    const db = getDatabase();
    const privateRef = db.ref("users/" + uid);
    const privateSnap = await privateRef.get();
    if (!privateSnap.exists()) throw new HttpsError("not-found", "Аккаунт не найден.");
    const updates = {};
    Object.keys(allowed).forEach((key) => {
      updates["users/" + uid + "/" + key] = allowed[key];
      updates["publicUsers/" + uid + "/" + key] = allowed[key];
    });
    updates["publicUsers/" + uid + "/id"] = uid;
    await db.ref().update(updates);
    const current = privateSnap.val() || {};
    return { ok: true, profile: Object.assign({
      id: uid,
      name: current.name || uid,
      avatar: current.avatar || "",
      bio: current.bio || "",
      avatarUrl: current.avatarUrl || null
    }, allowed) };
  }
);
