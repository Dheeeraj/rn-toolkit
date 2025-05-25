import { existsSync, rmSync, unlinkSync } from "fs";
import { execSync, spawnSync, type SpawnSyncOptions } from "child_process";
import os from "os";
import { join } from "path";
import { execa, ExecaError } from "execa";
import type { CleanArgsType } from "./types";
import { printPerf } from "./performance";
import { printCmdError, printError, printVerbose } from "./print";
import { CleanAndroid } from "./clean/android-clean";
import { CleanIOS } from "./clean/ios-clean";
const appRoot = process.cwd();

const lockFileAndCacheClearCmd = [
  { file: "package-lock.json", command: ["npm", "cache", "clean", "--force"] },
  { file: "yarn.lock", command: ["yarn", "cache", "clean"] },
  { file: "pnpm-lock.yaml", command: ["pnpm", "store", "prune"] },
  { file: "bun.lockb", command: ["bun", "cache", "clean"] },
];

export async function clean(platform: CleanArgsType): Promise<void> {
  return await printPerf(async () => {
    const isClearAll = platform === "all";
    if (platform === "android" || isClearAll) {
      await CleanAndroid();
    }
    if (platform === "ios" || isClearAll) {
      await CleanIOS();
    }
    if (platform === "cache" || isClearAll) {
      await ClearRnCache();
    }
  }, "Completed Cleaning");
}

function ClearNodeModulus() {
  printVerbose("Cleaning node_modules");
  const nodeModulesPath = "./node_modules";
  if (existsSync(nodeModulesPath)) {
    printVerbose("Deleting node_modules");
    // Delete the node_modules directory recursively
    if (os.platform() === "win32") {
      printVerbose("Deleting node_modules on Windows");
      rmSync(nodeModulesPath, { recursive: true, force: true });
    } else {
      printVerbose("Deleting node_modules on Unix");
      execSync("rm -rf ./node_modules");
    }
  } else {
    printError("The node_modules directory does not exist.");
  }
}

function CleanLockFiles() {
  lockFileAndCacheClearCmd.forEach(({ file, command }) => {
    const filePath = join(appRoot, file);

    if (existsSync(filePath)) {
      // Wrap command execution in printPerf
      let executable = command[0];
      printPerf(() => {
        let childProcessOptions: SpawnSyncOptions = {
          stdio: "inherit",
        }; // Default options

        let args = command.slice(1);

        // If the last item is an object, use it as options for the child process
        if (typeof command[command.length - 1] === "object") {
          childProcessOptions = command[command.length - 1] as SpawnSyncOptions;
          args = command.slice(1, -1); // Adjust args to exclude the options object
        }

        // Execute the command with dynamically determined args and options
        const result = spawnSync(executable, args, childProcessOptions);

        if (result.status === 0) {
          printVerbose(`${executable} cache cleaned successfully.`);
        } else {
          printVerbose(`Error cleaning ${executable} cache.`);
          printError(result.error as unknown as string);
        }
      }, `${executable} cache clean executed`);

      // Wrap file deletion in printPerf
      printPerf(() => {
        unlinkSync(filePath);
      }, `${file} deleted`);
    }
  });
}

// TODO: Can be added later if needed
async function ForceKillWatchMan() {
  try {
    await execa(os.platform() === "win32" ? "tskill" : "dhee", ["watchman"], {
      cwd: appRoot,
    });
  } catch (killError) {
    printCmdError(killError as ExecaError);
  }
}

async function CleanWatchMan() {
  try {
    await printPerf(async () => {
      try {
        // First try graceful shutdown
        printVerbose("Shutting down Watchman");
        const result = await execa("watchman", ["shutdown-server"], {
          cwd: appRoot,
        });
        printVerbose(`Watchman shutdown in ${result.durationMs}ms`);
      } catch (error) {
        printVerbose("Failed to shutdown Watchman");
        printCmdError(error as ExecaError);
      }
    }, "Stopping Watchman");

    await printPerf(async () => {
      // Use watch-del with the current directory path instead of watch-del-all
      printVerbose("Deleting Watchman cache of current project");
      const result = await execa("watchman", ["watch-del", appRoot], {
        cwd: appRoot,
      });
      printVerbose(`Watchman cache deleted in ${result.durationMs}ms`);

      // Only delete the watchman state for the current project
      const watchmanStateDir = join(os.homedir(), ".watchman");
      const projectWatchmanState = join(watchmanStateDir, "state");
      if (existsSync(projectWatchmanState)) {
        printVerbose("Deleting Watchman state for current project");
        rmSync(projectWatchmanState, { recursive: true, force: true });
      }
    }, "Watchman cache deleted");
  } catch (error) {
    printVerbose("Failed to clean Watchman");
    printError(error as string);
  }
}

async function CleanMetroCache() {
  await printPerf(async () => {
    const tempDir = os.tmpdir();
    const platform = os.platform();

    // Clean Haste map cache
    printVerbose("Cleaning Haste map cache");
    const hastePattern =
      platform === "win32"
        ? join(tempDir, "haste-map-*")
        : join(tempDir, "haste-map-*");

    try {
      if (platform === "win32") {
        await execa("cmd", ["/c", `del /Q "${hastePattern}"`]);
      } else {
        await execa("rm", ["-f", hastePattern]);
      }
      printVerbose("Haste map cache cleaned");
    } catch (error) {
      // Ignore errors if no files found
      printVerbose("No Haste map cache found or already cleaned");
    }

    // Clean Metro cache
    printVerbose("Cleaning Metro cache");
    const metroCachePath = join(tempDir, "metro-cache");

    try {
      if (existsSync(metroCachePath)) {
        if (platform === "win32") {
          await execa("cmd", ["/c", `rmdir /S /Q "${metroCachePath}"`]);
        } else {
          await execa("rm", ["-rf", metroCachePath]);
        }
        printVerbose("Metro cache cleaned");
      } else {
        printVerbose("No Metro cache found");
      }
    } catch (error) {
      printCmdError(error as ExecaError);
    }
  }, "Metro and Haste cache cleaned");
}

async function ClearRnCache() {
  printPerf(ClearNodeModulus, "node_modules deleted");

  CleanLockFiles();

  await CleanWatchMan();

  await CleanMetroCache();

  printVerbose("Done");
}
