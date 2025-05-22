import { join } from "path";
import { existsSync, rmSync } from "fs";
import { execa, ExecaError } from "execa";
import os from "os";

import { printError, printCmdError, printVerbose, printLog } from "../print";
import { printPerf } from "../performance";

const appRoot = process.cwd();

const androidPaths = [
  ".gradle",
  ".idea",
  ".cxx",
  "build",
  ".kotlin",
  join("app", ".cxx"),
];

async function StopGradleDaemon() {
  const androidDir = join(appRoot, "android");
  if (!existsSync(androidDir)) {
    return;
  }

  printVerbose("Stopping Gradle daemon");
  const gradlewCmd = os.platform() === "win32" ? "gradlew.bat" : "./gradlew";

  try {
    await execa(gradlewCmd, ["--stop"], {
      cwd: androidDir,
      shell: true,
    });
    printVerbose("Gradle daemon stopped");
  } catch (error) {
    printCmdError(error as ExecaError);
  }
}

async function ClearGradleCache() {
  return await printPerf(async () => {
    const gradleCacheDir = join(os.homedir(), ".gradle", "caches");
    if (!existsSync(gradleCacheDir)) {
      printVerbose("Gradle cache directory not found");
      return;
    }

    printVerbose("Cleaning Gradle cache");
    try {
      if (os.platform() === "win32") {
        // On Windows, use cmd to handle long paths
        await execa(
          "cmd",
          [
            "/c",
            `if exist "${gradleCacheDir}" rmdir /S /Q "${gradleCacheDir}"`,
          ],
          {
            shell: true,
          }
        );
      } else {
        // On Unix, use find to delete files and directories
        await execa("find", [gradleCacheDir, "-type", "f", "-delete"], {
          shell: true,
        });
        await execa("find", [gradleCacheDir, "-type", "d", "-delete"], {
          shell: true,
        });
      }
      printVerbose("Gradle cache cleaned successfully");
    } catch (error) {
      printCmdError(error as ExecaError);
      printVerbose("Failed to clean Gradle cache");
    }
  }, "Gradle cache cleaned");
}

async function CleanAndroidBuildCache() {
  return await printPerf(async () => {
    const androidDir = join(appRoot, "android");
    if (!existsSync(androidDir)) {
      printError("Android directory not found");
      return;
    }

    printVerbose("Cleaning Android build cache");
    const gradlewCmd = os.platform() === "win32" ? "gradlew.bat" : "./gradlew";

    try {
      const result = await execa(gradlewCmd, ["clean"], {
        cwd: androidDir,
        shell: true,
        stdio: "inherit",
      });
      printVerbose(`Android build cache cleaned in ${result.durationMs}ms`);
    } catch (error) {
      printCmdError(error as ExecaError);
    }
  }, "Android build cache cleaned");
}

async function ClearOtherBuildFolders() {
  return await printPerf(async () => {
    const androidDir = join(appRoot, "android");
    if (!existsSync(androidDir)) {
      printError("Android directory not found");
      return;
    }

    printVerbose("Cleaning Android build folders");

    for (const path of androidPaths) {
      const fullPath = join(androidDir, path);
      printVerbose(`Attempting to clean: ${fullPath}`);

      if (existsSync(fullPath)) {
        try {
          if (os.platform() === "win32") {
            // On Windows, use cmd to handle long paths and locked files
            await execa(
              "cmd",
              ["/c", `if exist "${fullPath}" rmdir /S /Q "${fullPath}"`],
              {
                shell: true,
                cwd: androidDir,
              }
            );
          } else {
            // On Unix, use rm -rf with proper path
            await execa("rm", ["-rf", fullPath], {
              shell: true,
              cwd: androidDir,
            });
          }
          printVerbose(`Successfully cleaned: ${path}`);
        } catch (error) {
          printCmdError(error as ExecaError);
          printVerbose(`Failed to clean: ${path}`);
        }
      } else {
        printVerbose(`Path not found: ${path}`);
      }
    }
  }, "Android build folders cleaned");
}

export async function CleanAndroid() {
  printVerbose("Cleaning Android");

  await CleanAndroidBuildCache();
  await ClearOtherBuildFolders();
  //   // First stop Gradle daemon to release file locks
  await StopGradleDaemon();
  await ClearGradleCache();
}
