const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  readCache,
  writeCache,
  resolveCacheDir,
  resolveCacheTtlHours,
} = require("../bin/cache");

const URL = "https://registry.npmjs.org/npm-get-author-packages";

function sandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "npm-get-author-packages-"));
}

/** Rewrites the stamp of the single entry in the directory, in hours back. */
function ageEntry(directory, hours) {
  const [file] = fs.readdirSync(directory);
  const target = path.join(directory, file);
  const entry = JSON.parse(fs.readFileSync(target, "utf-8"));
  entry.savedAt = Date.now() - hours * 60 * 60 * 1000;
  fs.writeFileSync(target, JSON.stringify(entry), "utf-8");
}

function withEnv(patch, run) {
  const previous = {};

  for (const [key, value] of Object.entries(patch)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("the cache lives in the user's cache directory, not in the package", () => {
  withEnv({ XDG_CACHE_HOME: undefined }, () => {
    assert.equal(
      resolveCacheDir(),
      path.join(os.homedir(), ".cache", "npm-get-author-packages"),
    );
  });
});

test("the cache directory honors XDG_CACHE_HOME", () => {
  withEnv({ XDG_CACHE_HOME: "/somewhere" }, () => {
    assert.equal(
      resolveCacheDir(),
      path.join("/somewhere", "npm-get-author-packages"),
    );
  });
});

test("entries are valid for 12 hours unless told otherwise", () => {
  withEnv({ CACHE_TTL_HOURS: undefined }, () => {
    assert.equal(resolveCacheTtlHours(), 12);
  });
  withEnv({ CACHE_TTL_HOURS: "1" }, () => {
    assert.equal(resolveCacheTtlHours(), 1);
  });
  withEnv({ CACHE_TTL_HOURS: "0" }, () => {
    assert.equal(resolveCacheTtlHours(), 0);
  });
});

test("a nonsense TTL falls back to the default instead of disabling the cache", () => {
  for (const value of ["", "   ", "soon", "-1"]) {
    withEnv({ CACHE_TTL_HOURS: value }, () => {
      assert.equal(resolveCacheTtlHours(), 12, `for value: ${value}`);
    });
  }
});

test("a missing entry reads back as null", () => {
  assert.equal(readCache(URL, sandbox()), null);
});

test("a cached body round-trips", () => {
  const directory = sandbox();
  writeCache(URL, { "dist-tags": { latest: "1.1.0" } }, directory);

  assert.deepEqual(readCache(URL, directory), {
    "dist-tags": { latest: "1.1.0" },
  });
});

test("entries are kept separate per URL", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);
  writeCache(`${URL}-other`, { name: "b" }, directory);

  assert.deepEqual(readCache(URL, directory), { name: "a" });
  assert.deepEqual(readCache(`${URL}-other`, directory), { name: "b" });
});

test("an entry older than the TTL is discarded", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);
  ageEntry(directory, 13);

  assert.equal(readCache(URL, directory), null);
});

test("an entry younger than the TTL is kept", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);
  ageEntry(directory, 11);

  assert.deepEqual(readCache(URL, directory), { name: "a" });
});

test("a TTL of 0 keeps entries forever", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);
  ageEntry(directory, 24 * 365);

  withEnv({ CACHE_TTL_HOURS: "0" }, () => {
    assert.deepEqual(readCache(URL, directory), { name: "a" });
  });
});

test("an entry with no usable timestamp is discarded", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);

  const [file] = fs.readdirSync(directory);
  const entry = JSON.parse(
    fs.readFileSync(path.join(directory, file), "utf-8"),
  );
  delete entry.savedAt;
  fs.writeFileSync(path.join(directory, file), JSON.stringify(entry), "utf-8");

  assert.equal(readCache(URL, directory), null);
});

test("valid JSON that is not an entry is treated as a missing one", () => {
  // "null" parses fine, and reading .savedAt off it used to throw.
  for (const content of ["null", "42", '"text"', "[]"]) {
    const directory = sandbox();
    writeCache(URL, { name: "a" }, directory);
    const [file] = fs.readdirSync(directory);
    fs.writeFileSync(path.join(directory, file), content, "utf-8");

    assert.equal(readCache(URL, directory), null, `for content: ${content}`);
  }
});

test("a corrupted entry is treated as a missing one", () => {
  const directory = sandbox();
  writeCache(URL, { name: "a" }, directory);
  const [file] = fs.readdirSync(directory);
  fs.writeFileSync(path.join(directory, file), "{ not json", "utf-8");

  assert.equal(readCache(URL, directory), null);
});

test("an unwritable cache directory does not throw", () => {
  // A regular file can never be a parent directory, so mkdir fails with
  // ENOTDIR everywhere. A hard-coded /dev/null would not do: on Windows that
  // is an ordinary relative path, which mkdir would happily create - the test
  // would pass while testing nothing, and leave a stray directory behind.
  const file = path.join(sandbox(), "not-a-directory");
  fs.writeFileSync(file, "", "utf-8");

  assert.doesNotThrow(() => {
    writeCache(URL, { name: "a" }, path.join(file, "nope"));
  });
});
