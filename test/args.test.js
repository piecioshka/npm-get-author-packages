const test = require("node:test");
const assert = require("node:assert");

const { parseArgs } = require("../src/args");

test("a bare username is parsed with the defaults", () => {
  assert.deepEqual(parseArgs(["piecioshka"]), {
    help: false,
    user: "piecioshka",
    withDependencies: false,
    useCache: true,
  });
});

test("--with-dependencies and --no-cache are recognized in any order", () => {
  const options = parseArgs(["--no-cache", "piecioshka"]);

  assert.equal(options.user, null);
  assert.equal(options.useCache, false);

  const reordered = parseArgs(["piecioshka", "--no-cache"]);

  assert.equal(reordered.user, "piecioshka");
  assert.equal(reordered.useCache, false);
  assert.equal(reordered.withDependencies, false);

  assert.equal(
    parseArgs(["piecioshka", "--with-dependencies"]).withDependencies,
    true,
  );
});

test("a leading flag is a missing username, not a login", () => {
  // Without this, `npm-get-author-packages --no-cache` used to query the
  // registry for a maintainer literally named "--no-cache".
  for (const argv of [["--no-cache"], ["--with-dependencies"], ["-h"], []]) {
    assert.equal(parseArgs(argv).user, null, `for argv: ${argv.join(" ")}`);
  }
});

test("help is requested by -h and --help", () => {
  assert.equal(parseArgs(["-h"]).help, true);
  assert.equal(parseArgs(["--help"]).help, true);
  assert.equal(parseArgs(["piecioshka", "--help"]).help, true);
  assert.equal(parseArgs(["piecioshka"]).help, false);
});
