import type { CommandPlatformType } from "./types";

export function rename(platform: CommandPlatformType, newName: string): void {
  console.log(`Renaming project for platform: ${platform} to ${newName}`);
  // Add your renaming logic here
}
