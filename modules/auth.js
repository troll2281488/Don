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
    register: register,
    sendPasswordReset: sendPasswordReset,
    signOut: signOut,
    onChange: onChange
  };
})(window);
