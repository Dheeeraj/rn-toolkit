import chalk from "chalk";
import type { CommandPlatformType, RenameOptions } from "./types";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { printError, printLog, printVerbose } from "./print";
import { join } from "path";

const packageJsonPath = "./package.json";

interface IPlatformReturn {
  platform: CommandPlatformType;
  skipToNextArg: boolean;
}

export function determinePlatform(arg: string): IPlatformReturn {
  const returnValue: IPlatformReturn = {
    platform: "all",
    skipToNextArg: true,
  };

  switch (arg) {
    case "android":
    case "a":
      returnValue.platform = "android";
      break;
    case "ios":
    case "i":
      returnValue.platform = "ios";
      break;
    case "all":
      break;
    default:
      returnValue.skipToNextArg = false;
  }

  return returnValue;
}

export function determineRenameOption(arg: string): RenameOptions | undefined {
  switch (arg) {
    case "app":
    case "a":
    case "A":
      return "app";
    case "bundle":
    case "b":
    case "B":
      return "bundle";
    default:
      return undefined;
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
      printVerbose("The current directory is a React Native project");
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

interface IReplaceConfig {
  filePath: string;
  pattern: RegExp;
  replacement: string;
  successMessage: string;
}

export async function replaceInFile(config: IReplaceConfig): Promise<void> {
  const { filePath, pattern, replacement, successMessage } = config;

  if (!existsSync(filePath)) {
    printError(`File not found: ${filePath}`);
    return;
  }

  try {
    let content = readFileSync(filePath, "utf8");
    const oldValueMatch = content.match(pattern);
    const oldValue = oldValueMatch ? oldValueMatch[1] : "unknown";

    content = content.replace(pattern, replacement);
    writeFileSync(filePath, content, "utf8");

    printLog(successMessage.replace("{old}", oldValue));
  } catch (error) {
    printError(error as string);
    printVerbose(`Failed to update file: ${filePath}`);
  }
}

export function getIosProjectName(): string {
  const iosDir = join(process.cwd(), "ios");
  if (!existsSync(iosDir)) {
    printError("iOS directory not found");
    return "";
  }

  try {
    const files = readdirSync(iosDir);
    const projectFile = files.find(
      (file) => file.endsWith(".xcodeproj") || file.endsWith(".xcworkspace")
    );

    if (!projectFile) {
      printError("No .xcodeproj or .xcworkspace found in iOS directory");
      return "";
    }

    // Remove the extension to get the project name
    return projectFile.replace(/\.(xcodeproj|xcworkspace)$/, "");
  } catch (error) {
    printError("Failed to read iOS directory");
    return "";
  }
}

export function showHelp(): void {
  printVerbose("Showing help");
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
