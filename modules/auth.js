/* DonorGram authentication helpers.
 * Requires Firebase compat app/auth/functions SDKs for the legacy bridge,
 * and Firebase compat app/auth SDKs for the email-auth helpers.
 * The legacy bridge is wired behind opt-in feature flags in the old login UI.
 * Keep this module separate so the existing interface and account data remain intact.
 */
(function (global) {
  "use strict";

  function getAuth() {
    if (!global.firebase || !global.firebase.auth) {
      throw new Error("Firebase Authentication SDK не загружен.");
    }
    return global.firebase.auth();
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function signInLegacy(username, password) {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    var call = functions("europe-west1").httpsCallable("signInLegacyAccount");
    return call({ username: String(username || "").trim(), password: String(password || "") })
      .then(function (result) {
        var data = result && result.data || {};
        if (!data.token) throw new Error("Сервер не вернул токен входа.");
        return getAuth().signInWithCustomToken(data.token).then(function (credential) {
          return { user: credential.user, profile: data.profile || {}, username: data.username || username };
        });
      });
  }

  function searchLegacyUsers(query) {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    return functions("europe-west1").httpsCallable("searchLegacyUsers")({ query: String(query || "").trim() })
      .then(function (result) { return result && result.data && Array.isArray(result.data.users) ? result.data.users : []; });
  }

  function getLegacyPublicProfile(uid) {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    return functions("europe-west1").httpsCallable("getLegacyPublicProfile")({ uid: String(uid || "").trim() })
      .then(function (result) { return result && result.data ? result.data.profile || null : null; });
  }


  function getLegacyPublicProfiles(uids) {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    return functions("europe-west1").httpsCallable("getLegacyPublicProfiles")({ uids: Array.isArray(uids) ? uids : [] })
      .then(function (result) { return result && result.data && result.data.profiles || {}; });
  }


  function getLegacySessionProfile() {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    return functions("europe-west1").httpsCallable("getLegacySessionProfile")({})
      .then(function (result) {
        var data = result && result.data || {};
        if (!data.profile || !data.uid) throw new Error("Сервер не подтвердил сессию.");
        return data;
      });
  }


  function updateLegacyProfile(profile) {
    var functions = global.firebase && global.firebase.functions;
    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));
    return functions("europe-west1").httpsCallable("updateLegacyProfile")({ profile: profile || {} })
      .then(function (result) { return result && result.data || { ok: false }; });
  }

  function restoreLegacySession() {
    try {
      return new Promise(function (resolve, reject) {
        var auth = getAuth();
        var unsubscribe = auth.onAuthStateChanged(function (user) {
          if (unsubscribe) unsubscribe();
          resolve(user || null);
        }, function (error) {
          if (unsubscribe) unsubscribe();
          reject(error);
        });
      });
    } catch (error) { return Promise.reject(error); }
  }

  function signIn(email, password) {
    return getAuth().signInWithEmailAndPassword(normalizeEmail(email), password);
  }

  function register(email, password) {
    if (String(password || "").length < 8) {
      return Promise.reject(new Error("Пароль должен содержать минимум 8 символов."));
    }
    return getAuth().createUserWithEmailAndPassword(normalizeEmail(email), password);
  }

  function sendPasswordReset(email) {
    return getAuth().sendPasswordResetEmail(normalizeEmail(email));
  }

  function signOut() {
    return getAuth().signOut();
  }

  function onChange(callback) {
    return getAuth().onAuthStateChanged(callback);
  }

  global.DonorGramAuth = {
    signIn: signIn,
    signInLegacy: signInLegacy,
    restoreLegacySession: restoreLegacySession,
    searchLegacyUsers: searchLegacyUsers,
    getLegacyPublicProfile: getLegacyPublicProfile,
    getLegacyPublicProfiles: getLegacyPublicProfiles,
    getLegacySessionProfile: getLegacySessionProfile,
    updateLegacyProfile: updateLegacyProfile,
    register: register,
    sendPasswordReset: sendPasswordReset,
    signOut: signOut,
    onChange: onChange
  };
})(window);
