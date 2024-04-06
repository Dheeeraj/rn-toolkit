import { performance } from "perf_hooks";
import { printLog, printError } from "./print";

let startTime: number;

// Call this at the start of an operation
function startStats() {
  startTime = performance.now();
}

// Call this at the end of an operation
function endStats(message: string) {
  const endTime = performance.now();
  const duration = endTime - startTime;
  printLog(`${message} ${duration.toFixed(2)}ms`);
}

export function printPerf(action: Function, operationName: string) {
  try {
    startStats();
    action();
    endStats(operationName);
  } catch (err) {
    printError(err as string);
  }
}
