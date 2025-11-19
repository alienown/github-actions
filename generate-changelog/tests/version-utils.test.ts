import { describe, it, expect, vi } from "vitest";
import { readVersionFromFile } from "../src/version-utils";
import { readFile } from "fs/promises";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

const mockReadFile = vi.mocked(readFile);

describe("version-utils", () => {
  describe("readVersionFromFile", () => {
    describe("package.json files", () => {
      it("should read version from valid package.json", async () => {
        const packageJson = JSON.stringify({ version: "1.2.3" });
        mockReadFile.mockResolvedValue(packageJson);

        const version = await readVersionFromFile("package.json");

        expect(version).toBe("1.2.3");
        expect(mockReadFile).toHaveBeenCalledWith("package.json", "utf-8");
      });

      it("should trim whitespace from package.json version", async () => {
        const packageJson = JSON.stringify({ version: "  1.2.3  " });
        mockReadFile.mockResolvedValue(packageJson);

        const version = await readVersionFromFile("package.json");

        expect(version).toBe("1.2.3");
      });

      it("should throw error for invalid JSON in package.json", async () => {
        mockReadFile.mockResolvedValue("{ invalid json }");

        await expect(readVersionFromFile("package.json")).rejects.toThrowError(
          "Invalid JSON in package.json. Your project must have proper versioning.",
        );
      });

      it("should throw error when version field is missing in package.json", async () => {
        const packageJson = JSON.stringify({ name: "test-package" });
        mockReadFile.mockResolvedValue(packageJson);

        await expect(readVersionFromFile("package.json")).rejects.toThrowError(
          "No 'version' field found in package.json. Your project must have proper versioning.",
        );
      });

      it("should throw error when version field is empty in package.json", async () => {
        const packageJson = JSON.stringify({ version: "" });
        mockReadFile.mockResolvedValue(packageJson);

        await expect(readVersionFromFile("package.json")).rejects.toThrowError(
          "No 'version' field found in package.json. Your project must have proper versioning.",
        );
      });

      it("should throw error when version field is only whitespace in package.json", async () => {
        const packageJson = JSON.stringify({ version: "   " });
        mockReadFile.mockResolvedValue(packageJson);

        await expect(readVersionFromFile("package.json")).rejects.toThrowError(
          "Empty 'version' field in package.json. Your project must have proper versioning.",
        );
      });
    });

    describe("text version files", () => {
      it("should read version from single-line text file", async () => {
        mockReadFile.mockResolvedValue("2.0.0");

        const version = await readVersionFromFile("VERSION");

        expect(version).toBe("2.0.0");
        expect(mockReadFile).toHaveBeenCalledWith("VERSION", "utf-8");
      });

      it("should read version from first line of multi-line text file", async () => {
        mockReadFile.mockResolvedValue("3.1.4\nsome other content\nmore lines");

        const version = await readVersionFromFile("VERSION");

        expect(version).toBe("3.1.4");
      });

      it("should trim whitespace from text file version", async () => {
        mockReadFile.mockResolvedValue("  1.0.0-beta  \n");

        const version = await readVersionFromFile("VERSION");

        expect(version).toBe("1.0.0-beta");
      });

      it("should throw error for empty text file", async () => {
        mockReadFile.mockResolvedValue("");

        await expect(readVersionFromFile("VERSION")).rejects.toThrowError(
          "Empty version file: VERSION. Your project must have proper versioning.",
        );
      });

      it("should throw error for text file with only whitespace", async () => {
        mockReadFile.mockResolvedValue("   \n  \n");

        await expect(readVersionFromFile("VERSION")).rejects.toThrowError(
          "Empty version file: VERSION. Your project must have proper versioning.",
        );
      });
    });

    describe("file reading errors", () => {
      it("should throw error when file cannot be read", async () => {
        mockReadFile.mockRejectedValue(new Error("ENOENT: file not found"));

        await expect(
          readVersionFromFile("missing-file.json"),
        ).rejects.toThrowError(
          "Failed to read version from missing-file.json: Error: ENOENT: file not found",
        );
      });
    });
  });
});
