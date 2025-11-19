import { readFile } from "fs/promises";

/**
 * Read and parse version from supported file formats
 * Supports: package.json and single-line version files
 */
export async function readVersionFromFile(
  versionFilePath: string,
): Promise<string> {
  try {
    const content = await readFile(versionFilePath, "utf-8");

    // Detect if it's a package.json
    if (versionFilePath.endsWith("package.json")) {
      return parseVersionFromPackageJson(content, versionFilePath);
    }

    // Otherwise treat as single-line version file
    return parseVersionFromTextFile(content, versionFilePath);
  } catch (error) {
    throw new Error(
      `Failed to read version from ${versionFilePath}: ${String(error)}`,
    );
  }
}

/**
 * Parse version from package.json
 */
function parseVersionFromPackageJson(
  content: string,
  filePath: string,
): string {
  let json: { version?: string } | undefined | null;

  try {
    json = JSON.parse(content) as typeof json;
  } catch {
    throw new Error(
      `Invalid JSON in ${filePath}. Your project must have proper versioning.`,
    );
  }

  if (!json?.version) {
    throw new Error(
      `No 'version' field found in ${filePath}. Your project must have proper versioning.`,
    );
  }

  const version = json.version.trim();

  if (!version) {
    throw new Error(
      `Empty 'version' field in ${filePath}. Your project must have proper versioning.`,
    );
  }

  return version;
}

/**
 * Parse version from single-line text file
 */
function parseVersionFromTextFile(content: string, filePath: string): string {
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim();

  if (!firstLine) {
    throw new Error(
      `Empty version file: ${filePath}. Your project must have proper versioning.`,
    );
  }

  return firstLine;
}
