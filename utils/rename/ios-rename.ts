import { printVerbose } from "../print";

export async function renameIosBundle(newName: string): Promise<void> {
  printVerbose(`Renaming iOS Bundle for platform: ${newName}`);
}
