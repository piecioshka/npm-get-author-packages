"use strict";

const USAGE = [
  "Usage: npm-get-author-packages <username> [--with-dependencies] [--no-cache]",
  "",
  "  Display npm packages of an author with their creation date.",
  "",
  "Arguments:",
  "  username             npm author/maintainer login (e.g. piecioshka).",
  "",
  "Options:",
  "  --with-dependencies  Also list each package's dependencies.",
  "  --no-cache           Ignore cached entries for this run.",
  "  -h, --help           Show this help and exit.",
  "",
  "Environment:",
  "  CACHE_TTL_HOURS      How long a cached response stays valid",
  "                       (default: 12, 0 = forever).",
  "",
  "Cached responses live in ~/.cache/npm-get-author-packages.",
  "",
  "Example:",
  "  npm-get-author-packages piecioshka",
].join("\n");

const SHORT_USAGE =
  "Usage: npm-get-author-packages <username> [--with-dependencies] [--no-cache]";

/**
 * @param {string[]} argv arguments without the node binary and script path
 * @returns {{ help: boolean, user: string | null, withDependencies: boolean, useCache: boolean }}
 */
function parseArgs(argv) {
  const help = argv.includes("-h") || argv.includes("--help");

  // A flag in the first position is a missing username, not a login - without
  // this, `npm-get-author-packages --no-cache` would query for "--no-cache".
  const [first] = argv;
  const user = !first || first.startsWith("-") ? null : first;

  return {
    help,
    user,
    withDependencies: argv.includes("--with-dependencies"),
    useCache: !argv.includes("--no-cache"),
  };
}

module.exports = { parseArgs, USAGE, SHORT_USAGE };
