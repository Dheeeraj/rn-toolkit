#!/usr/bin/env bun

import {
  clean,
  rename,
  determinePlatform,
  showHelp,
  checkForRn,
} from "./utils";

function main() {
  if (!checkForRn()) return;
  const args = Bun.argv.slice(2); // Ignoring the first two elements

  let argumentIndex = 0;
  const command = args[argumentIndex];
  argumentIndex++;
  const platform = determinePlatform(args[argumentIndex]);
  if (platform !== "all") {
    argumentIndex++;
  }

  // The newName is relevant only for the rename command
  const newName = command === "rename" && args.length > 2 ? args[1] : "";

  // Switch to identify the command and execute the corresponding function
  switch (command) {
    case "clean":
      clean(platform, args[argumentIndex]);
      break;
    case "rename":
      rename(platform, newName);
      break;
    case "help":
    default:
      showHelp();
  }
}

main();
