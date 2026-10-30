/* DonorGram file helpers. No automatic upload or external transmission. */
(function (global) {
  "use strict";

  var DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

  function validate(file, options) {
    options = options || {};
    if (!file) throw new Error("Файл не выбран.");
    var maxBytes = Number(options.maxBytes) || DEFAULT_MAX_BYTES;
    if (file.size > maxBytes) {
      throw new Error("Файл слишком большой. Максимум: " + Math.round(maxBytes / 1024 / 1024) + " МБ.");
    }
    var allowed = options.allowedTypes;
    if (Array.isArray(allowed) && allowed.length && allowed.indexOf(file.type) === -1) {
      throw new Error("Этот тип файла не поддерживается.");
    }
    return file;
  }

  function readAsDataURL(file, options) {
    try { validate(file, options); } catch (error) { return Promise.reject(error); }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error("Не удалось прочитать файл.")); };
      reader.onabort = function () { reject(new Error("Чтение файла отменено.")); };
      reader.readAsDataURL(file);
    });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " Б";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
    return (bytes / 1024 / 1024).toFixed(1) + " МБ";
  }

  global.DonorGramFiles = {
    validate: validate,
    readAsDataURL: readAsDataURL,
    formatSize: formatSize
  };
})(window);
