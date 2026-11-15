/**
 * @file src/shared/i18n/index.js
 * @goal Locale registry, template interpolation, and RTL direction helper.
 */

import { STRINGS_EN } from "./strings.en.js";

let activeStrings = STRINGS_EN;

export function getStrings() {
  return activeStrings;
}

export function setStrings(localeStrings) {
  if (localeStrings && typeof localeStrings === "object") {
    activeStrings = localeStrings;
    applyDocumentDirection(activeStrings.dir);
  }
}

export function applyDocumentDirection(dir = activeStrings.dir) {
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.dir = dir === "rtl" ? "rtl" : "ltr";
  }
}

/**
 * Look up a dot-separated string key and replace `{token}` placeholders.
 * @param {string} path
 * @param {Record<string, string | number>} [vars]
 * @param {Object} [source]
 * @returns {string}
 */
export function t(path, vars = {}, source = activeStrings) {
  const parts = String(path).split(".");
  let val = source;
  for (const part of parts) {
    val = val?.[part];
    if (val === undefined) break;
  }
  if (typeof val !== "string") return String(path);
  return val.replace(/\{(\w+)\}/g, (_m, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}
