"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CACHE_NAMESPACE = "npm-get-author-packages";

// A packument changes only when a version is published, so half a day keeps
// reruns free without letting a listing drift from the registry.
const DEFAULT_TTL_HOURS = 12;

/**
 * The cache belongs to the user, not to the package. Installed globally the
 * package directory sits inside node_modules, which is read-only in many
 * setups and wiped on every reinstall.
 * @returns {string}
 */
function resolveCacheDir() {
  const cacheHome =
    process.env.XDG_CACHE_HOME?.trim() || path.join(os.homedir(), ".cache");
  return path.join(cacheHome, CACHE_NAMESPACE);
}

/**
 * How long an entry stays valid, in hours. An empty value means "unset", not
 * "0 hours" - the latter would read as "keep forever". A malformed or
 * negative value would silently disable the cache, so it falls back too.
 * @returns {number}
 */
function resolveCacheTtlHours() {
  const raw = process.env.CACHE_TTL_HOURS?.trim();

  if (!raw) {
    return DEFAULT_TTL_HOURS;
  }

  const hours = Number(raw);
  return Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_TTL_HOURS;
}

/**
 * @param {string} url
 * @param {string} directory
 * @returns {string}
 */
function entryPath(url, directory) {
  const hash = crypto.createHash("sha256").update(`GET:${url}`).digest("hex");
  return path.join(directory, `${hash.slice(0, 32)}.json`);
}

/**
 * @param {unknown} savedAt
 * @returns {boolean}
 */
function isExpired(savedAt) {
  const ttlHours = resolveCacheTtlHours();

  // A TTL of 0 means "keep forever".
  if (ttlHours === 0) {
    return false;
  }

  // An entry that cannot be aged is dropped rather than trusted forever.
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) {
    return true;
  }

  return Date.now() - savedAt > ttlHours * 60 * 60 * 1000;
}

/**
 * Returns the stored body, or null when the entry is missing, expired or
 * unreadable. A cache problem must never take the command down.
 * @param {string} url
 * @param {string} [directory]
 * @returns {unknown | null}
 */
function readCache(url, directory = resolveCacheDir()) {
  let entry;

  try {
    entry = JSON.parse(fs.readFileSync(entryPath(url, directory), "utf-8"));
  } catch {
    return null;
  }

  // A file holding valid JSON that is not an entry - "null", "42", an array -
  // is as useless as a corrupted one, and reading a field off null throws.
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  return isExpired(entry.savedAt) ? null : (entry.body ?? null);
}

/**
 * @param {string} url
 * @param {unknown} body
 * @param {string} [directory]
 */
function writeCache(url, body, directory = resolveCacheDir()) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      entryPath(url, directory),
      JSON.stringify({ url, savedAt: Date.now(), body }),
      "utf-8",
    );
  } catch {
    // An unwritable cache directory must not take the command down with it.
  }
}

module.exports = {
  readCache,
  writeCache,
  resolveCacheDir,
  resolveCacheTtlHours,
};
