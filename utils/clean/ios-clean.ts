import { printError, printVerbose, printCmdError, printLog } from "../print";
import { execa, ExecaError } from "execa";
import { platform } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { printPerf } from "../performance";

const appRoot = process.cwd();

async function ClearPodCache() {
  return await printPerf(async () => {
    const iosDir = join(appRoot, "ios");
    if (!existsSync(iosDir)) {
      printError("iOS directory not found");
      return;
    }

    printVerbose("Running pod deintegrate");
    try {
      await execa("pod", ["deintegrate"], {
        stdio: "inherit",
        cwd: iosDir,
      });
      printVerbose("Pod deintegration completed");
    } catch (error) {
      printCmdError(error as ExecaError);
      printVerbose("Failed to run pod deintegrate");
    }
  }, "Pod cache cleared");
}

async function ClearIosBuildFolders() {
  return await printPerf(async () => {
    const iosDir = join(appRoot, "ios");
    if (!existsSync(iosDir)) {
      printError("iOS directory not found");
      return;
    }

    printVerbose("Clearing iOS build folders");
    const foldersToRemove = ["build", "Pods", "Podfile.lock", "DerivedData"];

    for (const folder of foldersToRemove) {
      const path = join(iosDir, folder);
      printVerbose(`Attempting to clean: ${path}`);

      if (existsSync(path)) {
        try {
          if (platform() === "win32") {
            // On Windows, use cmd to handle long paths and locked files
            await execa(
              "cmd",
              ["/c", `if exist "${path}" rmdir /S /Q "${path}"`],
              {
                shell: true,
                cwd: iosDir,
              }
            );
          } else {
            // On Unix, use rm -rf with proper path
            await execa("rm", ["-rf", path], {
              shell: true,
              cwd: iosDir,
            });
          }
          printVerbose(`Successfully cleaned: ${folder}`);
        } catch (error) {
          printCmdError(error as ExecaError);
          printVerbose(`Failed to clean: ${folder}`);
        }
      } else {
        printVerbose(`Path not found: ${folder}`);
      }
    }
  }, "iOS build folders cleaned");
}

export async function CleanIOS() {
  if (platform() !== "darwin") {
    printError("CocoaPods commands can only be run on macOS");
    return;
  }

  printVerbose("Cleaning iOS");

  await ClearPodCache();
  await ClearIosBuildFolders();
}
