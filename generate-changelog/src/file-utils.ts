import { readFile, access } from "fs/promises";
import { constants } from "fs";

/**
 * Extract the section for a specific version from changelog content
 */
function extractVersionSection(
  changelogContent: string,
  version: string,
): string | null {
  if (!changelogContent) {
    return null;
  }

  if (!version) {
    throw new Error("Version must be provided to extract section");
  }

  // Find the version header
  const versionHeaderRegex = new RegExp(
    `^## ${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "m",
  );
  const match = changelogContent.match(versionHeaderRegex);

  if (!match || match.index === undefined) {
    return null;
  }

  // Find the end of this version's section (next ## or end of file)
  const afterHeader = changelogContent.substring(
    match.index + match[0].length,
  );
  const nextSectionMatch = afterHeader.match(/^## /m);

  let sectionContent: string;
  if (nextSectionMatch && nextSectionMatch.index !== undefined) {
    sectionContent = afterHeader.substring(0, nextSectionMatch.index).trim();
  } else {
    sectionContent = afterHeader.trim();
  }

  return sectionContent;
}

/**
 * Read changelog file and extract version section
 */
export async function readChangelogVersionSection(
  changelogPath: string,
  version: string,
): Promise<string | null> {
  try {
    await access(changelogPath, constants.F_OK);
    const content = await readFile(changelogPath, "utf-8");
    return extractVersionSection(content, version);
  } catch {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Build CHANGELOG.md content with new entry
 */
export async function buildChangelogContent(
  changelogPath: string,
  newEntry: string,
) {
  let existingContent = "";
  let fileExists = false;

  // Check if file exists
  try {
    await access(changelogPath, constants.F_OK);
    existingContent = await readFile(changelogPath, "utf-8");
    fileExists = true;
  } catch {
    // File doesn't exist
  }

  console.log("Building changelog content...");

  // Extract version from newEntry (e.g., "## 1.0.0")
  const versionMatch = newEntry.match(/^##\s+(.+?)(?:\n|$)/m);
  const version = versionMatch ? versionMatch[1].trim() : null;

  let updatedContent: string;

  if (!fileExists || existingContent.trim() === "") {
    // Create new CHANGELOG.md
    updatedContent = `# Changelog\n\n${newEntry.trim()}\n\n`;
  } else {
    // Check if version section already exists
    const versionExists = version && existingContent.includes(`## ${version}`);

    if (versionExists) {
      // Replace existing version section with new content from LLM
      const versionHeaderRegex = new RegExp(
        `^## ${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
        "m",
      );
      const match = existingContent.match(versionHeaderRegex);

      if (match && match.index !== undefined) {
        // Find the end of this version's section (next ## or end of file)
        const afterHeader = existingContent.substring(
          match.index + match[0].length,
        );
        const nextSectionMatch = afterHeader.match(/^## /m);

        let endOfSection: number;
        if (nextSectionMatch && nextSectionMatch.index !== undefined) {
          // End is at the start of the next section
          endOfSection = match.index + match[0].length + nextSectionMatch.index;
        } else {
          // This is the last section, end is at the end of file
          endOfSection = existingContent.length;
        }

        // Replace the entire section with the new content from LLM
        updatedContent =
          existingContent.substring(0, match.index) +
          newEntry.trim() +
          "\n\n" +
          existingContent.substring(endOfSection);
      } else {
        // Fallback: prepend new entry
        const lines = existingContent.split("\n");
        const headerIndex = lines.findIndex((line) => line.startsWith("# "));
        let insertIndex = headerIndex !== -1 ? headerIndex + 1 : 0;
        while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
          insertIndex++;
        }
        lines.splice(insertIndex, 0, newEntry.trim());
        updatedContent = lines.join("\n");
      }
    } else {
      // Insert new version section after header
      const lines = existingContent.split("\n");
      const headerIndex = lines.findIndex((line) => line.startsWith("# "));

      if (headerIndex !== -1) {
        // Insert after header and any empty lines
        let insertIndex = headerIndex + 1;
        while (insertIndex < lines.length && lines[insertIndex].trim() === "") {
          insertIndex++;
        }

        lines.splice(insertIndex, 0, newEntry.trim());
        updatedContent = lines.join("\n");
      } else {
        // No header found, prepend
        updatedContent = `# Changelog\n\n${newEntry.trim()}\n\n${existingContent}`;
      }
    }
  }

  return updatedContent;
}
