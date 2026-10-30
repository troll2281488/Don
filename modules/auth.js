/* DonorGram email authentication module.
 * Requires Firebase compat SDK: firebase-app-compat.js and firebase-auth-compat.js.
 * This module is intentionally separate from the existing chat UI so the current
 * interface can be preserved while authentication is integrated and tested.
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

  function signInLegacy(username, password) {\n    var functions = global.firebase && global.firebase.functions;\n    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));\n    var call = functions("europe-west1").httpsCallable("signInLegacyAccount");\n    return call({ username: String(username || "").trim(), password: String(password || "") })\n      .then(function (result) {\n        var data = result && result.data || {};\n        if (!data.token) throw new Error("Сервер не вернул токен входа.");\n        return getAuth().signInWithCustomToken(data.token).then(function (credential) {\n          return { user: credential.user, profile: data.profile || {}, username: data.username || username };\n        });\n      });\n  }\n\n  function searchLegacyUsers(query) {\n    var functions = global.firebase && global.firebase.functions;\n    if (!functions) return Promise.reject(new Error("Firebase Functions SDK не загружен."));\n    return functions("europe-west1").httpsCallable("searchLegacyUsers")({ query: String(query || "").trim() })\n      .then(function (result) { return result && result.data && Array.isArray(result.data.users) ? result.data.users : []; });\n  }\n\n  function signIn(email, password) {
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
    signIn: signIn,\n    signInLegacy: signInLegacy,\n    searchLegacyUsers: searchLegacyUsers,
    register: register,
    sendPasswordReset: sendPasswordReset,
    signOut: signOut,
    onChange: onChange
  };
})(window);
