"use strict";

const { parseArgs, USAGE, SHORT_USAGE } = require("./args");
const { template, printError, printWarning } = require("./format");
const { getUserPackages } = require("./registry");

/**
 * Runs the CLI and resolves with the process exit code.
 * @param {string[]} argv arguments without the node binary and script path
 * @returns {Promise<number>}
 */
async function run(argv) {
  const { help, user, withDependencies, useCache } = parseArgs(argv);

  if (help) {
    console.log(USAGE);
    return 0;
  }

  if (!user) {
    console.log(SHORT_USAGE);
    return 1;
  }

  let packages;

  try {
    packages = await getUserPackages(user, { withDependencies, useCache });
  } catch (error) {
    printError(error.message);
    return 1;
  }

  if (packages.length === 0) {
    printWarning("No packages found");
    return 0;
  }

  packages.sort((a, b) => a.date - b.date);

  console.log(`Found ${packages.length} package(s):`);
  packages.forEach((pkg) => console.log(template(pkg)));

  return 0;
}

module.exports = { run };
