import chalk from "chalk";

export function printLog(str: string) {
  console.log(chalk.green(str));
}
export function printInfo(str: string) {
  console.log(chalk.yellow(str));
}
export function printError(str: string) {
  console.log(chalk.redBright.bold(str));
}
