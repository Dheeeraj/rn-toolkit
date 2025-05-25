#!/usr/bin/env bun

import {
  clean,
  rename,
  determinePlatform,
  showHelp,
  checkForRn,
} from "./utils";
import { UpdateVerbose, printVerbose } from "./utils/print";

function main() {
  // UpdateVerbose(true);
  // Check if the current directory is a React Native project
  printVerbose("Checking if the current directory is a React Native project");
  if (!checkForRn()) {
    printVerbose("The current directory is not a React Native project");
    return;
  }

  // Get the command and platform from the arguments
  const args = Bun.argv.slice(2); // Ignoring the first two elements

  // Initialize the command and platform variables
  let argumentIndex = 0;
  const command = args[argumentIndex];
  argumentIndex++;
  const platformResponse = determinePlatform(args[argumentIndex]);
  if (platformResponse.skipToNextArg) {
    argumentIndex++;
  }

  // Switch to identify the command and execute the corresponding function
  switch (command) {
    case "clean":
      printVerbose("Cleaning the project");
      clean(platformResponse.platform);
      break;
    case "rename":
      printVerbose("Renaming the project");
      rename(platformResponse.platform, args.slice(argumentIndex));
      break;
    case "help":
    default:
      printVerbose("Showing help");
      showHelp();
  }
}

main();
