"use strict";

const { readCache, writeCache } = require("./cache");

const REGISTRY_URL = "https://registry.npmjs.org";

// The search endpoint caps a single page at 250 objects.
const PAGE_SIZE = 250;

/**
 * GETs a JSON document, served from the disk cache when allowed.
 * @param {string} url
 * @param {boolean} useCache
 * @returns {Promise<any>}
 */
async function makeRequest(url, useCache = true) {
  if (useCache) {
    const cached = readCache(url);
    if (cached !== null) {
      return cached;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const body = await response.json();

  // A fresh response refreshes the cache even under --no-cache: the flag is
  // about not trusting what is stored, not about refusing to store.
  writeCache(url, body);

  return body;
}

/**
 * Yields every package the user maintains, paginating the search endpoint.
 * @param {string} username
 * @param {boolean} useCache
 */
async function* fetchUserPackages(username, useCache = true) {
  let from = 0;

  while (true) {
    const searchUrl =
      `${REGISTRY_URL}/-/v1/search` +
      `?text=maintainer:${username}&from=${from}&size=${PAGE_SIZE}`;
    let data = {
      objects: [],
      total: 0,
      time: new Date().toISOString(),
    };

    try {
      data = await makeRequest(searchUrl, useCache);
    } catch (error) {
      throw new Error(error.message);
    }

    const { objects: packages, total } = data;

    for (const pkg of packages) {
      yield pkg;
    }

    const done = total <= from + PAGE_SIZE;

    if (!done) {
      console.log(`Fetched ${Math.min(total, from + PAGE_SIZE)} packages...`);
      from += PAGE_SIZE;
    } else {
      break;
    }
  }
}

/**
 * @param {string} username
 * @param {{ withDependencies?: boolean, useCache?: boolean }} options
 * @returns {Promise<object[]>}
 */
async function getUserPackages(username, options = {}) {
  const { withDependencies = false, useCache = true } = options;
  const result = [];

  for await (const pkg of fetchUserPackages(username, useCache)) {
    const summary = pkg.package;
    const packageName = summary.name;
    const isCLI = summary.keywords.includes("cli");
    const packageData = await makeRequest(
      `${REGISTRY_URL}/${packageName}`,
      useCache,
    );

    const versions = Object.keys(packageData.time);
    const createdAt = new Date(packageData.time[versions[0]]);

    const latestVersion = packageData["dist-tags"].latest;
    const hasTypes = packageData.versions[latestVersion].types;

    const packageInfo = {
      date: createdAt,
      name: packageName,
      version: summary.version,
      hasTypes,
      isCLI,
    };

    if (withDependencies) {
      packageInfo.dependencies =
        packageData.versions[latestVersion].dependencies || {};
    }

    result.push(packageInfo);
  }

  return result;
}

module.exports = { getUserPackages, fetchUserPackages, makeRequest };
