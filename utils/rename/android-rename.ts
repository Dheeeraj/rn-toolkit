import { join } from "path";
import ignore from "ignore";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
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

interface FileUpdateConfig {
  filePath: string;
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

async function updateFiles(
  config: BundleConfig,
  files: FileUpdateConfig[]
): Promise<void> {
  for (const file of files) {
    const fullPath = join(process.cwd(), file.filePath);
    const fileName = file.filePath.split("/").pop() || file.filePath;

    if (!existsSync(fullPath)) {
      printError(`${fileName} not found`);
      continue;
    }

    const content = readFileSync(fullPath, "utf8");
    const { content: newContent, replacements } = replaceBundleName(
      content,
      config.oldBundle,
      config.newBundle
    );

    if (replacements > 0) {
      writeFileSync(fullPath, newContent, "utf8");
      printLog(
        `Updated ${replacements} instances in ${fileName} from ${config.oldBundle} -> ${config.newBundle}`
      );
    } else {
      printVerbose(`No instances found to replace in ${fileName}`);
    }
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

function parseGitignore(dir: string): ignore.Ignore {
  const ig = ignore();
  const gitignorePath = join(dir, ".gitignore");

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf8");
    ig.add(content);
  }

  return ig;
}

function shouldIgnoreFile(filePath: string, ig: ignore.Ignore): boolean {
  const relativePath = filePath.replace(process.cwd(), "").replace(/^\//, "");
  const shouldIgnore = ig.ignores(relativePath);

  if (shouldIgnore) {
    printVerbose(`File ${relativePath} matches gitignore pattern`);
  }

  return shouldIgnore;
}

async function updateAllFilesInAndroid(config: BundleConfig): Promise<void> {
  const androidDir = join(process.cwd(), "android");
  const newBundlePath = join(
    androidDir,
    "app",
    "src",
    "main",
    "java",
    config.newPath
  );
  const ig = parseGitignore(process.cwd());

  async function processDirectory(dir: string): Promise<number> {
    let totalReplacements = 0;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip the new bundle path directory
      if (fullPath === newBundlePath) {
        printVerbose(`Skipping new bundle path: ${fullPath}`);
        continue;
      }

      // Skip files that match gitignore patterns
      if (shouldIgnoreFile(fullPath, ig)) {
        printVerbose(`Skipping gitignored file: ${fullPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        totalReplacements += await processDirectory(fullPath);
      } else {
        // Skip binary files and other non-text files
        if (
          entry.name.endsWith(".class") ||
          entry.name.endsWith(".dex") ||
          entry.name.endsWith(".apk") ||
          entry.name.endsWith(".aab") ||
          entry.name.endsWith(".so") ||
          entry.name.endsWith(".aar")
        ) {
          continue;
        }

        try {
          const content = readFileSync(fullPath, "utf8");
          const { content: newContent, replacements } = replaceBundleName(
            content,
            config.oldBundle,
            config.newBundle
          );

          if (replacements > 0) {
            writeFileSync(fullPath, newContent, "utf8");
            printLog(
              `Updated ${replacements} instances in ${fullPath} from ${config.oldBundle} -> ${config.newBundle}`
            );
            totalReplacements += replacements;
          }
        } catch (error) {
          // Skip files that can't be read as text
          printVerbose(`Skipping binary file: ${fullPath}`);
        }
      }
    }

    return totalReplacements;
  }

  const totalReplacements = await processDirectory(androidDir);
  if (totalReplacements > 0) {
    printLog(
      `Updated ${totalReplacements} total instances across all files in Android directory`
    );
  } else {
    printVerbose(
      "No additional instances found to replace in Android directory"
    );
  }
}

async function updateAllFilesInProject(config: BundleConfig): Promise<void> {
  const projectRoot = process.cwd();
  const ig = parseGitignore(projectRoot);

  // Add additional ignore patterns for project-wide search
  ig.add([
    "android/**",
    "ios/**",
    ".*/**", // Ignore all hidden directories
    "node_modules/**",
    "build/**",
    "dist/**",
    ".git/**",
  ]);

  async function processDirectory(dir: string): Promise<number> {
    let totalReplacements = 0;
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      // Skip files that match gitignore patterns
      if (shouldIgnoreFile(fullPath, ig)) {
        printVerbose(`Skipping gitignored file: ${fullPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        totalReplacements += await processDirectory(fullPath);
      } else {
        // Skip binary files and other non-text files
        if (
          entry.name.endsWith(".class") ||
          entry.name.endsWith(".dex") ||
          entry.name.endsWith(".apk") ||
          entry.name.endsWith(".aab") ||
          entry.name.endsWith(".so") ||
          entry.name.endsWith(".aar") ||
          entry.name.endsWith(".png") ||
          entry.name.endsWith(".jpg") ||
          entry.name.endsWith(".jpeg") ||
          entry.name.endsWith(".gif") ||
          entry.name.endsWith(".ico") ||
          entry.name.endsWith(".ttf") ||
          entry.name.endsWith(".otf") ||
          entry.name.endsWith(".woff") ||
          entry.name.endsWith(".woff2")
        ) {
          continue;
        }

        try {
          const content = readFileSync(fullPath, "utf8");
          const { content: newContent, replacements } = replaceBundleName(
            content,
            config.oldBundle,
            config.newBundle
          );

          if (replacements > 0) {
            writeFileSync(fullPath, newContent, "utf8");
            printLog(
              `Updated ${replacements} instances in ${fullPath} from ${config.oldBundle} -> ${config.newBundle}`
            );
            totalReplacements += replacements;
          }
        } catch (error) {
          // Skip files that can't be read as text
          printVerbose(`Skipping binary file: ${fullPath}`);
        }
      }
    }

    return totalReplacements;
  }

  const totalReplacements = await processDirectory(projectRoot);
  if (totalReplacements > 0) {
    printLog(
      `Updated ${totalReplacements} total instances across all project files`
    );
  } else {
    printVerbose("No additional instances found to replace in project files");
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

    // Update all configuration files
    await updateFiles(config, [{ filePath: "package.json" }]);

    // Move and update all files in the old bundle path
    await moveAndUpdateJavaFiles(config);

    // Update all remaining files in Android directory
    await updateAllFilesInAndroid(config);

    // Update all the remaining files in the project ignoring android and ios folders
    await updateAllFilesInProject(config);

    printVerbose("Android bundle rename completed successfully");
  }, "Android bundle renamed");
}
