import { existsSync, rmSync, unlinkSync } from "fs";
import { execSync, spawnSync, type SpawnSyncOptions } from "child_process";
import os from "os";
import { join } from "path";
import { execa } from "execa";
import type { CleanArgsType } from "./types";
import { printPerf } from "./performance";
import { printError } from "./print";

const appRoot = process.cwd();

const lockFileAndCacheClearCmd = [
  { file: "package-lock.json", command: ["npm", "cache", "clean", "--force"] },
  { file: "yarn.lock", command: ["yarn", "cache", "clean"] },
  { file: "pnpm-lock.yaml", command: ["pnpm", "store", "prune"] },
  { file: "bun.lockb", command: ["bun", "cache", "clean"] },
];

export function clean(platform: CleanArgsType, nextArg: string): void {
  const isClearAll = platform === "all" && typeof nextArg === "undefined";
  if ((nextArg && nextArg === "cache") || isClearAll) {
    ClearRnCache();
  }
  if (platform === "android" || isClearAll) {
  }
  if (platform === "ios" || isClearAll) {
  }
}

function ClearNodeModulus() {
  const nodeModulesPath = "./node_modules";
  if (existsSync(nodeModulesPath)) {
    // Delete the node_modules directory recursively
    if (os.platform() === "win32") {
      rmSync(nodeModulesPath, { recursive: true, force: true });
    } else {
      execSync("rm -rf ./node_modules");
    }
  } else {
    throw new Error("The node_modules directory does not exist.");
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
          console.log(`${executable} cache cleaned successfully.`);
        } else {
          console.error(`Error cleaning ${executable} cache.`, result.error);
        }
      }, `${executable} cache clean executed`);

      // Wrap file deletion in printPerf
      printPerf(() => {
        unlinkSync(filePath);
      }, `${file} removed`);
    }
  });
}

async function CleanWatchMan() {
  try {
    await printPerf(async () => {
      await execa(
        os.platform() === "win32" ? "tskill" : "killall",
        ["watchman"],
        { cwd: appRoot }
      );
    }, "Stop Watchman");
    await printPerf(async () => {
      await execa("watchman", ["watch-del-all"], { cwd: appRoot });

      const watchmanStateDir = join(os.homedir(), ".watchman");
      if (existsSync(watchmanStateDir)) {
        rmSync(watchmanStateDir, { recursive: true, force: true });
      }
    }, "Delete Watchman cache");
  } catch (error) {
    printError(error as string);
  }
}

async function ClearRnCache() {
  console.log(os.tmpdir(), "temp");
  // printPerf(ClearNodeModulus, "node_modules removed");
  // CleanLockFiles();
  // await CleanWatchMan();
}
