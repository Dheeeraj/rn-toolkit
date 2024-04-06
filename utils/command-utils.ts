import chalk from "chalk";
import type { CommandPlatformType } from "./types";
import { existsSync, readFileSync } from "fs";

const packageJsonPath = "./package.json";

export function determinePlatform(args: string): CommandPlatformType {
  const platformArg = args;
  switch (platformArg) {
    case "android":
    case "a":
      return "android";
    case "ios":
    case "i":
      return "ios";
    default:
      return "all";
  }
}

export function checkForRn(): boolean {
  if (existsSync(packageJsonPath)) {
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");

    // Parse the content as JSON
    const packageJson = JSON.parse(packageJsonContent);

    if (
      (packageJson["dependencies"] &&
        packageJson["dependencies"]["react-native"]) ||
      (packageJson["devDependencies"] &&
        packageJson["devDependencies"]["react-native"])
    ) {
      return true;
    }

    console.error(
      chalk.red.bold(
        "Error: Oops, the current directory is not a React Native project"
      )
    );
    return false;
  } else {
    console.error(
      chalk.red.bold(
        "Error: package.json does not exist in the current directory."
      )
    );
    return false;
  }
}

export function showHelp(): void {
  console.log(`
  Available commands:
    clean      Clean project
    rename     Rename project
  
  Usage:
    bun run yourscript.ts clean [platform]
    bun run yourscript.ts rename [newName] [platform]
    bun run yourscript.ts help
  
  Platforms:
    android    Android platform
    ios        iOS platform
    If no platform is specified, 'all' platforms are assumed.
    `);
}
