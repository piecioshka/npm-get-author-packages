#!/usr/bin/env node

const { run } = require("../src/main");

run(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
});
