"use strict";

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

/**
 * Renders a single package line.
 * @param {{ date: Date, name: string, version: string, hasTypes: unknown, isCLI: boolean, dependencies?: Record<string, string> }} pkg
 * @returns {string}
 */
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
          .join(`${blueText}, `)}${blueText})${reset}`,
      );
    }
  }
  return output.join(" ");
};

module.exports = { template, printError, printWarning };
