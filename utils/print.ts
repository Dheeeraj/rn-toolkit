import chalk from "chalk";
import type { ExecaError } from "execa";

let verbose = false;

export function UpdateVerbose(newVerbose: boolean) {
  verbose = newVerbose;
}

export function printLog(str: string) {
  console.log(chalk.green(str));
}
export function printInfo(str: string) {
  console.log(chalk.yellow(str));
}
export function printCmdError(str: ExecaError) {
  console.log(chalk.redBright.bold(str.message));
}
export function printError(str: string) {
  console.log(chalk.redBright.bold(str));
}
export function printVerbose(str: string) {
  if (verbose) {
    console.log(chalk.gray(`[${new Date().toISOString()}] ${str}`));
  }
}
