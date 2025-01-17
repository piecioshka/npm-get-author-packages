#!/usr/bin/env node

const user = process.argv[2];

if (!user) {
  console.error("Usage: npm-get-author-packages <username>");
  process.exit(1);
}

const displayTypeScript = () => {
  const style = "\x1b[48;2;48;120;198;38;2;255;255;255m";
  const resetStyle = "\x1b[0m";
  return `${style} TS ${resetStyle}`;
};

const displayCLI = () => {
  const style = "\x1b[48;2;48;72;94;38;2;255;255;255m";
  const resetStyle = "\x1b[0m";
  return `${style} CLI ${resetStyle}`;
};

const template = ({ date, name, hasTypes, isCLI }) => {
  const ts = hasTypes ? displayTypeScript() : "";
  const cli = isCLI ? displayCLI() : "";
  const output = [`- [${date.toISOString()}] ${name}`];
  ts && output.push(ts);
  cli && output.push(cli);
  return output.join(" ");
};

async function makeRequest(url) {
  const response = await fetch(url);
  return await response.json();
}

async function* fetchUserPackages(username) {
  const maxSize = 250;
  let from = 0;

  while (true) {
    const searchUrl = `https://registry.npmjs.org/-/v1/search?text=maintainer:${username}&from=${from}&size=${maxSize}`;
    const data = await makeRequest(searchUrl);
    const packages = data.objects.map((pkg) => pkg.package);

    for (const pkg of packages) {
      yield pkg;
    }

    const done = data.total <= from + maxSize;

    if (!done) {
      console.log(
        `Fetched ${Math.min(data.total, from + maxSize)} packages...`
      );
      from += maxSize;
    } else {
      break;
    }
  }
}

async function getUserPackages(username) {
  const result = [];
  const packages = fetchUserPackages(username);

  for await (const package of packages) {
    const packageName = package.name;
    const isCLI = package.keywords.includes("cli");
    const packageUrl = `https://registry.npmjs.org/${packageName}`;
    const packageData = await makeRequest(packageUrl);

    const versions = Object.keys(packageData.time);
    const createdAt = new Date(packageData.time[versions[0]]);

    const latestVersion = packageData["dist-tags"].latest;
    const hasTypes = packageData.versions[latestVersion].types;

    result.push({
      date: createdAt,
      name: packageName,
      hasTypes,
      isCLI,
    });
  }

  return result;
}

getUserPackages(user)
  .then((packages) => packages.sort((a, b) => a.date - b.date))
  .then((packages) => {
    if (packages.length === 0) {
      console.log("No packages found");
      return;
    }

    console.log(`Found ${packages.length} packages:`);
    packages.forEach((pkg) => console.log(template(pkg)));
  })
  .catch((error) => {
    console.error("Error:", error);
  });
