import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { determineRenameOption, getIosProjectName } from "./command-utils";
import { printError, printVerbose } from "./print";
import type { CommandPlatformType } from "./types";
import { printPerf } from "./performance";
import { replaceInFile } from "./command-utils";
import { renameAndroidBundle } from "./rename/android-rename";
import { renameIosBundle } from "./rename/ios-rename";

export async function renameAndroidApp(newName: string): Promise<void> {
  return await printPerf(async () => {
    const androidDir = join(process.cwd(), "android");
    if (!existsSync(androidDir)) {
      printError("Android directory not found");
      return;
    }

    const stringsXmlPath = join(
      androidDir,
      "app",
      "src",
      "main",
      "res",
      "values",
      "strings.xml"
    );

    await replaceInFile({
      filePath: stringsXmlPath,
      pattern: /<string name="app_name">(.*?)<\/string>/,
      replacement: `<string name="app_name">${newName}</string>`,
      successMessage: `Successfully renamed Android app name from {old} -> ${newName}`,
    });
  }, "Android app renamed");
}

export async function renameIosApp(newName: string): Promise<void> {
  return await printPerf(async () => {
    const iosDir = join(process.cwd(), "ios");
    if (!existsSync(iosDir)) {
      printError("iOS directory not found");
      return;
    }

    const projectName = getIosProjectName();
    if (!projectName) {
      printError("Could not determine iOS project name");
      return;
    }

    // Find Info.plist in the iOS project
    const possiblePaths = [
      join(iosDir, "Info.plist"), // Root level
      join(iosDir, projectName, "Info.plist"), // Standard structure
      join(iosDir, "App", "Info.plist"), // Alternative structure
    ];

    const infoPlistPath = possiblePaths.find((path) => existsSync(path));
    if (!infoPlistPath) {
      printError("Info.plist not found in iOS project");
      return;
    }

    // First read the current CFBundleDisplayName value
    const content = readFileSync(infoPlistPath, "utf8");
    const displayNameMatch = content.match(
      /<key>CFBundleDisplayName<\/key>\s*<string>(.*?)<\/string>/
    );

    if (!displayNameMatch) {
      printError("CFBundleDisplayName not found in Info.plist");
      return;
    }

    const currentDisplayName = displayNameMatch[1];

    // If the display name is using a variable (starts with $)
    if (currentDisplayName.startsWith("$")) {
      // Extract the variable name (remove $ and parentheses)
      const variableName = currentDisplayName
        .replace(/[$(]/g, "")
        .replace(/\)/g, "");

      // Update the variable in project.pbxproj
      const pbxprojPath = join(
        iosDir,
        `${projectName}.xcodeproj`,
        "project.pbxproj"
      );
      if (existsSync(pbxprojPath)) {
        await replaceInFile({
          filePath: pbxprojPath,
          pattern: new RegExp(`${variableName} = "(.*?)";`),
          replacement: `${variableName} = "${newName}";`,
          successMessage: `Successfully updated ${variableName} from {old} -> ${newName}`,
        });
      }
    } else {
      // If it's a direct value, just update CFBundleDisplayName
      await replaceInFile({
        filePath: infoPlistPath,
        pattern: /<key>CFBundleDisplayName<\/key>\s*<string>(.*?)<\/string>/,
        replacement: `<key>CFBundleDisplayName</key>\n\t<string>${newName}</string>`,
        successMessage: `Successfully renamed iOS app display name from {old} -> ${newName}`,
      });
    }
  }, "iOS app renamed");
}

export async function renameApp(
  platform: CommandPlatformType,
  newName: string
): Promise<void> {
  printVerbose(`Renaming project for platform: ${platform} to ${newName}`);
  const isAll = platform === "all";
  if (platform === "android" || isAll) {
    await renameAndroidApp(newName);
  } else if (platform === "ios" || isAll) {
    await renameIosApp(newName);
  }
}

export async function renameBundle(
  platform: CommandPlatformType,
  newName: string
): Promise<void> {
  printVerbose(
    `Renaming project Bundle for platform: ${platform} to ${newName}`
  );
  const isAll = platform === "all";
  if (platform === "android" || isAll) {
    await renameAndroidBundle(newName);
  } else if (platform === "ios" || isAll) {
    await renameIosBundle(newName);
  }
}

export async function rename(
  platform: CommandPlatformType,
  nextArgs: string[]
): Promise<void> {
  const renameType = determineRenameOption(nextArgs[0]);
  if (!renameType) {
    printError(
      "Invalid rename option. Please use 'app' or 'bundle' to rename the project."
    );
    return;
  }

  const newName = nextArgs[1];
  if (!newName) {
    printError("Please provide a new name for the project.");
    return;
  }

  if (renameType === "app") {
    await renameApp(platform, newName);
  } else if (renameType === "bundle") {
    await renameBundle(platform, newName);
  }
}
