import { describe, it, expect, vi } from "vitest";
import {
  buildChangelogContent,
  readChangelogVersionSection,
} from "../src/file-utils";
import { readFile, access } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  access: vi.fn(),
}));

const mockReadFile = vi.mocked(readFile);
const mockAccess = vi.mocked(access);

describe("file-utils", () => {
  describe("buildChangelogContent", () => {
    describe("creating new CHANGELOG.md", () => {
      it("should build new CHANGELOG.md content when file does not exist", async () => {
        mockAccess.mockRejectedValue(new Error("ENOENT"));
        const newEntry = "## 1.0.0\n\n- Initial release\n- Added feature X";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 1.0.0\n\n- Initial release\n- Added feature X\n\n",
        );
      });
    });

    describe("handling empty or whitespace-only files", () => {
      it("should build CHANGELOG.md content when file is empty", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue("");
        const newEntry = "## 2.0.0\n\n- Major update";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe("# Changelog\n\n## 2.0.0\n\n- Major update\n\n");
      });

      it("should build CHANGELOG.md content when file contains only whitespace", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue("   \n  \n  ");
        const newEntry = "## 1.0.0\n\n- First release";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe("# Changelog\n\n## 1.0.0\n\n- First release\n\n");
      });
    });

    describe("inserting new version section", () => {
      it("should insert new version after header in existing changelog", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue(
          "# Changelog\n\n## 1.0.0\n\n- Previous release",
        );
        const newEntry = "## 2.0.0\n\n- New feature";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 2.0.0\n\n- New feature\n\n## 1.0.0\n\n- Previous release",
        );
      });

      it("should add header if missing and prepend new version", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue("## 1.0.0\n\n- Some content");
        const newEntry = "## 2.0.0\n\n- New content";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 2.0.0\n\n- New content\n\n## 1.0.0\n\n- Some content",
        );
      });
    });

    describe("replacing existing version section", () => {
      it("should replace latest version section with new content", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue(
          "# Changelog\n\n## 1.0.0\n\n- Feature A\n\n## 0.9.0\n\n- Old feature",
        );
        const newEntry = "## 1.0.0\n\n- Feature A\n- Feature B\n- Feature C";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 1.0.0\n\n- Feature A\n- Feature B\n- Feature C\n\n## 0.9.0\n\n- Old feature",
        );
      });

      it("should replace existing version section when it's the last section", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue(
          "# Changelog\n\n## 2.0.0\n\n- New feature\n\n## 1.0.0\n\n- Old content",
        );
        const newEntry = "## 1.0.0\n\n- Updated content\n- More updates";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 2.0.0\n\n- New feature\n\n## 1.0.0\n\n- Updated content\n- More updates\n\n",
        );
      });

      it("should preserve other version sections when replacing middle section", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue(
          "# Changelog\n\n## 2.0.0\n\n- Version 2 feature\n\n## 1.5.0\n\n- Old middle content\n\n## 1.0.0\n\n- Initial release",
        );
        const newEntry = "## 1.5.0\n\n- New middle content";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 2.0.0\n\n- Version 2 feature\n\n## 1.5.0\n\n- New middle content\n\n## 1.0.0\n\n- Initial release",
        );
      });
    });

    describe("edge cases", () => {
      it("should handle newEntry without version header", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue("# Changelog\n\n## 1.0.0\n\n- Old");
        const newEntry = "- New feature without header";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n- New feature without header\n\n## 1.0.0\n\n- Old",
        );
      });

      it("should trim whitespace from newEntry boundaries", async () => {
        mockAccess.mockResolvedValue(undefined);
        mockReadFile.mockResolvedValue("# Changelog\n\n## 1.0.0\n\n- Old");
        const newEntry = "\n\n  ## 2.0.0\n\n- New feature  \n\n";

        const result = await buildChangelogContent("CHANGELOG.md", newEntry);

        expect(result).toBe(
          "# Changelog\n\n## 2.0.0\n\n- New feature\n\n## 1.0.0\n\n- Old",
        );
      });
    });
  });

  describe("readChangelogVersionSection", () => {
    it("should extract latest version section from changelog content", async () => {
      const changelogContent = `# Changelog

## 2.0.0

- Added new feature
- Fixed bug

## 1.0.0

- Initial release`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection("CHANGELOG.md", "2.0.0");

      expect(result).toBe("- Added new feature\n- Fixed bug");
    });

    it("should extract first version section without trailing content", async () => {
      const changelogContent = `# Changelog

## 2.0.0

- Added feature A

## 1.0.0

- Initial release
- Basic functionality`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection("CHANGELOG.md", "1.0.0");

      expect(result).toBe("- Initial release\n- Basic functionality");
    });

    it("should return null when version not found", async () => {
      const changelogContent = `# Changelog

## 1.0.0

- Initial release`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection("CHANGELOG.md", "2.0.0");

      expect(result).toBeNull();
    });

    it("should return null when changelog content is empty", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue("");

      const result = await readChangelogVersionSection("CHANGELOG.md", "1.0.0");

      expect(result).toBeNull();
    });

    it("should handle version with special regex characters", async () => {
      const changelogContent = `# Changelog

## 1.0.0-beta.1

- Beta release

## 1.0.0

- Stable release`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection(
        "CHANGELOG.md",
        "1.0.0-beta.1",
      );

      expect(result).toBe("- Beta release");
    });

    it("should extract empty section when version has no content", async () => {
      const changelogContent = `# Changelog

## 2.0.0

## 1.0.0

- Initial release`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection("CHANGELOG.md", "2.0.0");

      expect(result).toBe("");
    });

    it("should handle multiple blank lines in version section", async () => {
      const changelogContent = `# Changelog

## 1.0.0

- Feature A


- Feature B

## 0.9.0

- Old feature`;

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(changelogContent);

      const result = await readChangelogVersionSection("CHANGELOG.md", "1.0.0");

      expect(result).toBe("- Feature A\n\n\n- Feature B");
    });

    it("should return null when file does not exist", async () => {
      mockAccess.mockRejectedValue(new Error("ENOENT"));

      const result = await readChangelogVersionSection("CHANGELOG.md", "1.0.0");

      expect(result).toBeNull();
    });

    it("should return null when file cannot be read (no permissions)", async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error("Permission denied"));

      const result = await readChangelogVersionSection("CHANGELOG.md", "1.0.0");

      expect(result).toBeNull();
    });
  });
});
