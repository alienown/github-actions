import { describe, it, expect, vi } from "vitest";
import { createOrUpdatePR } from "../src/pr-manager";
import type { getOctokit, context as GitHubContext } from "@actions/github";

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {},
}));

type Octokit = ReturnType<typeof getOctokit>;
type Context = typeof GitHubContext;

describe("pr-manager", () => {
  describe("createOrUpdatePR", () => {
    describe("updating existing PR", () => {
      it("should update existing PR by committing to its branch when file exists", async () => {
        const mockOctokit = {
          rest: {
            pulls: {
              get: vi.fn().mockResolvedValue({
                data: {
                  head: { ref: "feature-branch" },
                  base: { ref: "main" },
                },
              }),
            },
            repos: {
              getContent: vi.fn().mockResolvedValue({
                data: {
                  sha: "existing-file-sha",
                  type: "file",
                },
              }),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { repository: { default_branch: "main" } },
        };

        const result = await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "# Changelog\n\n## 1.0.0\n\n- New feature",
          42,
          true,
        );

        expect(mockOctokit.rest.pulls.get).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          pull_number: 42,
        });

        expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          ref: "feature-branch",
        });

        expect(
          mockOctokit.rest.repos.createOrUpdateFileContents,
        ).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          message: "chore: update CHANGELOG.md",
          content: Buffer.from(
            "# Changelog\n\n## 1.0.0\n\n- New feature",
          ).toString("base64"),
          branch: "feature-branch",
          sha: "existing-file-sha",
        });

        expect(result).toBe(42);
      });

      it("should update existing PR and create file when it doesn't exist in branch", async () => {
        const mockOctokit = {
          rest: {
            pulls: {
              get: vi.fn().mockResolvedValue({
                data: {
                  head: { ref: "new-feature-branch" },
                  base: { ref: "main" },
                },
              }),
            },
            repos: {
              getContent: vi.fn().mockRejectedValue(new Error("Not found")),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { repository: { default_branch: "main" } },
        };

        const result = await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "# Changelog\n\n## 2.0.0\n\n- Breaking change",
          99,
          true,
        );

        expect(
          mockOctokit.rest.repos.createOrUpdateFileContents,
        ).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          message: "chore: update CHANGELOG.md",
          content: Buffer.from(
            "# Changelog\n\n## 2.0.0\n\n- Breaking change",
          ).toString("base64"),
          branch: "new-feature-branch",
          sha: undefined,
        });

        expect(result).toBe(99);
      });

      it("should handle getContent returning array (directory)", async () => {
        const mockOctokit = {
          rest: {
            pulls: {
              get: vi.fn().mockResolvedValue({
                data: {
                  head: { ref: "branch-name" },
                  base: { ref: "main" },
                },
              }),
            },
            repos: {
              getContent: vi.fn().mockResolvedValue({
                data: [{ name: "file1" }, { name: "file2" }],
              }),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { repository: { default_branch: "main" } },
        };

        await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "content",
          10,
          true,
        );

        expect(
          mockOctokit.rest.repos.createOrUpdateFileContents,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            sha: undefined,
          }),
        );
      });
    });

    describe("creating new PR", () => {
      it("should create new PR with new branch when file exists in base", async () => {
        const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1234567890);

        const mockOctokit = {
          rest: {
            git: {
              getRef: vi.fn().mockResolvedValue({
                data: {
                  object: { sha: "base-commit-sha" },
                },
              }),
              createRef: vi.fn().mockResolvedValue({}),
            },
            repos: {
              get: vi.fn().mockResolvedValue({
                data: {
                  default_branch: "main",
                },
              }),
              getContent: vi.fn().mockResolvedValue({
                data: {
                  sha: "existing-changelog-sha",
                  type: "file",
                },
              }),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
            pulls: {
              create: vi.fn().mockResolvedValue({
                data: { number: 123 },
              }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { repository: { default_branch: "main" } },
        };

        const result = await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "# Changelog\n\n## 1.0.0\n\n- Initial release",
          null,
          false,
        );

        expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          ref: "heads/main",
        });

        expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          ref: "refs/heads/changelog-1234567890",
          sha: "base-commit-sha",
        });

        expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          ref: "main",
        });

        expect(
          mockOctokit.rest.repos.createOrUpdateFileContents,
        ).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          message: "chore: update CHANGELOG.md",
          content: Buffer.from(
            "# Changelog\n\n## 1.0.0\n\n- Initial release",
          ).toString("base64"),
          branch: "changelog-1234567890",
          sha: "existing-changelog-sha",
        });

        expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          title: "Update CHANGELOG.md",
          head: "changelog-1234567890",
          base: "main",
          body: "This PR updates the CHANGELOG.md file with recent changes.\n\nGenerated automatically by changelog-generator action.",
        });

        expect(result).toBe(123);

        dateSpy.mockRestore();
      });

      it("should create new PR and create file when it doesn't exist in base", async () => {
        const dateSpy = vi.spyOn(Date, "now").mockReturnValue(9876543210);

        const mockOctokit = {
          rest: {
            git: {
              getRef: vi.fn().mockResolvedValue({
                data: {
                  object: { sha: "base-sha" },
                },
              }),
              createRef: vi.fn().mockResolvedValue({}),
            },
            repos: {
              get: vi.fn().mockResolvedValue({
                data: {
                  default_branch: "main",
                },
              }),
              getContent: vi
                .fn()
                .mockRejectedValue(new Error("File not found")),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
            pulls: {
              create: vi.fn().mockResolvedValue({
                data: { number: 456 },
              }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { repository: { default_branch: "main" } },
        };

        const result = await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "# New Changelog",
          null,
          false,
        );

        expect(
          mockOctokit.rest.repos.createOrUpdateFileContents,
        ).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          path: "CHANGELOG.md",
          message: "chore: update CHANGELOG.md",
          content: Buffer.from("# New Changelog").toString("base64"),
          branch: "changelog-9876543210",
          sha: undefined,
        });

        expect(result).toBe(456);

        dateSpy.mockRestore();
      });

      it("should use default branch when repository default_branch is missing", async () => {
        const dateSpy = vi.spyOn(Date, "now").mockReturnValue(1111111111);

        const mockOctokit = {
          rest: {
            git: {
              getRef: vi.fn().mockResolvedValue({
                data: {
                  object: { sha: "sha123" },
                },
              }),
              createRef: vi.fn().mockResolvedValue({}),
            },
            repos: {
              get: vi.fn().mockResolvedValue({
                data: {
                  default_branch: "main",
                },
              }),
              getContent: vi.fn().mockRejectedValue(new Error("Not found")),
              createOrUpdateFileContents: vi.fn().mockResolvedValue({}),
            },
            pulls: {
              create: vi.fn().mockResolvedValue({
                data: { number: 789 },
              }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {},
        };

        await createOrUpdatePR(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          "CHANGELOG.md",
          "content",
          null,
          false,
        );

        expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          ref: "heads/main",
        });

        expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith(
          expect.objectContaining({
            base: "main",
          }),
        );

        dateSpy.mockRestore();
      });
    });
  });
});
