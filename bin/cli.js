#!/usr/bin/env node

const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  console.log(
    [
      "Usage: npm-get-author-packages <username> [--with-dependencies]",
      "",
      "  Display npm packages of an author with their creation date.",
      "",
      "Arguments:",
      "  username             npm author/maintainer login (e.g. piecioshka).",
      "",
      "Options:",
      "  --with-dependencies  Also list each package's dependencies.",
      "  -h, --help           Show this help and exit.",
      "",
      "Example:",
      "  npm-get-author-packages piecioshka",
    ].join("\n")
  );
  process.exit(0);
}

const user = process.argv[2];
const withDependencies = process.argv.includes("--with-dependencies");

if (!user) {
  console.log(
    "Usage: npm-get-author-packages <username> [--with-dependencies]"
  );
  process.exit(1);
}

const dateStyle = "\x1b[38;2;255;113;91m";
const versionStyle = "\x1b[38;2;76;84;84m";
const redText = "\x1b[38;2;234;68;87m";
const orangeText = "\x1b[38;2;255;205;76m";
const reset = "\x1b[0m";
const blueText = "\x1b[38;2;33;150;243m";
const yellowText = "\x1b[38;2;255;235;59m";
const italic = "\x1b[3m";

const printError = (text) => console.error(`${redText}${text}${reset}`);
const printWarning = (text) => console.warn(`${orangeText}${text}${reset}`);

const getTypeScriptIcon = () => {
  const style = "\x1b[48;2;48;120;198;38;2;255;255;255m";
  return `${style} TS ${reset}`;
};

const getCLIIcon = () => {
  const style = "\x1b[48;2;48;72;94;38;2;255;255;255m";
  return `${style} CLI ${reset}`;
};

const template = ({ date, name, version, hasTypes, isCLI, dependencies }) => {
  const ts = hasTypes ? getTypeScriptIcon() : "";
  const cli = isCLI ? getCLIIcon() : "";
  const output = [`-`];
  output.push(`${dateStyle}${date.toISOString().split("T")[0]}${reset}`);
  output.push(`${name}`);
  output.push(`${versionStyle}v${version}${reset}`);
  ts && output.push(ts);
  cli && output.push(cli);
  if (dependencies) {
    const depNames = Object.keys(dependencies);
    if (depNames.length > 0) {
      output.push(
        `${blueText}${italic}(deps: ${depNames
          .map((x) => `${yellowText}${x}`)
          .join(`${blueText}, `)}${blueText})${reset}`
      );
    }
  }
  return output.join(" ");
};

async function makeRequest(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  return await response.json();
}

async function* fetchUserPackages(username) {
  const maxSize = 250;
  let from = 0;

  while (true) {
    const searchUrl = `https://registry.npmjs.org/-/v1/search?text=maintainer:${username}&from=${from}&size=${maxSize}`;
    let data = {
      objects: [],
      total: 0,
      time: new Date().toISOString(),
    };

    try {
      data = await makeRequest(searchUrl);
    } catch (error) {
      throw new Error(error.message);
    }

    const { objects: packages, total } = data;

    for (const pkg of packages) {
      yield pkg;
    }

    const done = total <= from + maxSize;

    if (!done) {
      console.log(`Fetched ${Math.min(total, from + maxSize)} packages...`);
      from += maxSize;
    } else {
      break;
    }
  }
}

async function getUserPackages(username, withDependencies = false) {
  const result = [];
  const packages = fetchUserPackages(username);

  for await (const pkg of packages) {
    const package = pkg.package;
    const packageName = package.name;
    const isCLI = package.keywords.includes("cli");
    const packageUrl = `https://registry.npmjs.org/${packageName}`;
    const packageData = await makeRequest(packageUrl);

    const versions = Object.keys(packageData.time);
    const createdAt = new Date(packageData.time[versions[0]]);

    const latestVersion = packageData["dist-tags"].latest;
    const hasTypes = packageData.versions[latestVersion].types;

    const packageInfo = {
      date: createdAt,
      name: packageName,
      version: package.version,
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

getUserPackages(user, withDependencies)
  .then((packages) => packages.sort((a, b) => a.date - b.date))
  .then((packages) => {
    if (packages.length === 0) {
      printWarning("No packages found");
      return;
    }

    console.log(`Found ${packages.length} package(s):`);
    packages.forEach((pkg) => console.log(template(pkg)));
  })
  .catch((error) => {
    printError(error.message);
  });
