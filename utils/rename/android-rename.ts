import { join } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  rmdirSync,
  statSync,
  renameSync,
} from "fs";
import { printError, printLog, printVerbose } from "../print";
import { printPerf } from "../performance";

interface BundleConfig {
  oldBundle: string;
  newBundle: string;
  oldPath: string;
  newPath: string;
}

interface ReplacementResult {
  content: string;
  replacements: number;
}

function replaceBundleName(
  content: string,
  oldBundle: string,
  newBundle: string
): ReplacementResult {
  const newContent = content.replace(new RegExp(oldBundle, "g"), newBundle);

  const replacements = (content.match(new RegExp(oldBundle, "g")) || []).length;

  return { content: newContent, replacements };
}

async function getCurrentBundleName(): Promise<string> {
  const buildGradlePath = join(process.cwd(), "android", "app", "build.gradle");
  if (!existsSync(buildGradlePath)) {
    printError("build.gradle not found");
    return "";
  }

  const content = readFileSync(buildGradlePath, "utf8");
  const match = content.match(/applicationId\s+"([^"]+)"/);
  return match ? match[1] : "";
}

function createBundleConfig(
  oldBundle: string,
  newBundle: string
): BundleConfig {
  return {
    oldBundle,
    newBundle,
    oldPath: oldBundle.replace(/\./g, "/"),
    newPath: newBundle.replace(/\./g, "/"),
  };
}

async function updateBuildGradle(config: BundleConfig): Promise<void> {
  const buildGradlePath = join(process.cwd(), "android", "app", "build.gradle");
  const content = readFileSync(buildGradlePath, "utf8");

  const { content: newContent, replacements } = replaceBundleName(
    content,
    config.oldBundle,
    config.newBundle
  );

  if (replacements > 0) {
    writeFileSync(buildGradlePath, newContent, "utf8");
    printLog(
      `Updated ${replacements} instances in build.gradle from ${config.oldBundle} -> ${config.newBundle}`
    );
  } else {
    printError("No instances found to replace in build.gradle");
  }
}

async function updateAndroidManifest(config: BundleConfig): Promise<void> {
  const manifestPath = join(
    process.cwd(),
    "android",
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  const content = readFileSync(manifestPath, "utf8");

  const { content: newContent, replacements } = replaceBundleName(
    content,
    config.oldBundle,
    config.newBundle
  );

  if (replacements > 0) {
    writeFileSync(manifestPath, newContent, "utf8");
    printLog(
      `Updated ${replacements} instances in AndroidManifest.xml from ${config.oldBundle} -> ${config.newBundle}`
    );
  } else {
    printLog("No instances found to replace in AndroidManifest.xml");
  }
}

async function moveAndUpdateJavaFiles(config: BundleConfig): Promise<void> {
  const mainSrcPath = join(
    process.cwd(),
    "android",
    "app",
    "src",
    "main",
    "java"
  );
  const oldPath = join(mainSrcPath, config.oldPath);
  const newPath = join(mainSrcPath, config.newPath);
  const tempPath = join(mainSrcPath, `temp_${Date.now()}`);

  if (!existsSync(oldPath)) {
    printError(`Source path not found: ${oldPath}`);
    return;
  }

  try {
    // Create temporary directory
    mkdirSync(tempPath, { recursive: true });
    printVerbose(`Created temporary directory at ${tempPath}`);

    // Function to process a single file
    const processFile = async (filePath: string, relativePath: string) => {
      const content = readFileSync(filePath, "utf8");
      const tempFilePath = join(tempPath, relativePath);

      // Ensure the directory exists
      mkdirSync(
        join(tempPath, relativePath.split("/").slice(0, -1).join("/")),
        {
          recursive: true,
        }
      );

      const { content: newContent, replacements } = replaceBundleName(
        content,
        config.oldBundle,
        config.newBundle
      );

      // Always write the file to new location, even if no replacements were made
      writeFileSync(tempFilePath, newContent);

      if (replacements > 0) {
        printLog(`Updated ${replacements} instances in ${relativePath}`);
      } else {
        printVerbose(
          `Moved ${relativePath} to new location (no bundle name changes needed)`
        );
      }

      return replacements;
    };

    // Function to recursively process directory
    const processDirectory = async (
      dir: string,
      relativePath: string = ""
    ): Promise<number> => {
      let totalReplacements = 0;
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const newRelativePath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          // Create directory in temp path
          mkdirSync(join(tempPath, newRelativePath), { recursive: true });
          totalReplacements += await processDirectory(
            fullPath,
            newRelativePath
          );
        } else {
          totalReplacements += await processFile(fullPath, newRelativePath);
        }
      }

      return totalReplacements;
    };

    // Process all files and create new structure in temp directory
    const totalReplacements = await processDirectory(oldPath);
    printLog(
      `Updated ${totalReplacements} instances across all files in the old bundle path`
    );

    // Clean up old path
    if (existsSync(oldPath)) {
      rmdirSync(oldPath, { recursive: true });
      printVerbose(`Removed old directory at ${oldPath}`);
    }

    // Create new directory structure
    mkdirSync(newPath, { recursive: true });

    // Move temp directory to new path
    if (existsSync(newPath)) {
      rmdirSync(newPath, { recursive: true });
    }
    renameSync(tempPath, newPath);
    printVerbose(`Moved temporary directory to ${newPath}`);
  } catch (error) {
    printError(`Error during bundle rename: ${error}`);
    // Clean up temp directory if it exists
    if (existsSync(tempPath)) {
      rmdirSync(tempPath, { recursive: true });
    }
    throw error;
  }
}

export async function renameAndroidBundle(newName: string): Promise<void> {
  return await printPerf(async () => {
    const androidDir = join(process.cwd(), "android");
    if (!existsSync(androidDir)) {
      printError("Android directory not found");
      return;
    }

    const oldBundle = await getCurrentBundleName();
    if (!oldBundle) {
      printError("Could not determine current bundle name");
      return;
    }

    if (oldBundle === newName) {
      printError("New bundle name is the same as the current bundle name");
      return;
    }

    const config = createBundleConfig(oldBundle, newName);
    printVerbose(`Renaming Android bundle from ${oldBundle} to ${newName}`);

    // Update build.gradle
    await updateBuildGradle(config);

    // Update AndroidManifest.xml
    await updateAndroidManifest(config);

    // Move and update all files in the old bundle path
    await moveAndUpdateJavaFiles(config);

    printVerbose("Android bundle rename completed successfully");
  }, "Android bundle renamed");
}
