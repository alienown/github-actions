import { describe, it, expect, vi } from "vitest";
import { getNewCommits } from "../src/git-utils";
import type { getOctokit, context as GitHubContext } from "@actions/github";

// Mock @actions/github
vi.mock("@actions/github", () => ({
  getOctokit: vi.fn(),
  context: {},
}));

type Octokit = ReturnType<typeof getOctokit>;
type Context = typeof GitHubContext;

describe("git-utils", () => {
  describe("getNewCommits", () => {
    describe("PR events", () => {
      it("should fetch commits from PR when isPREvent is true", async () => {
        const mockCommits = [
          {
            sha: "abc123",
            commit: {
              message: "Add feature X",
              author: {
                name: "John Doe",
                email: "john@example.com",
                date: "2024-01-01",
              },
            },
          },
          {
            sha: "def456",
            commit: {
              message: "Fix bug Y",
              author: {
                name: "Jane Smith",
                email: "jane@example.com",
                date: "2024-01-02",
              },
            },
          },
        ];

        const mockOctokit = {
          rest: {
            pulls: {
              listCommits: vi.fn().mockResolvedValue({ data: mockCommits }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { pull_request: { number: 42 } },
        };

        const result = await getNewCommits(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          true,
        );

        expect(mockOctokit.rest.pulls.listCommits).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          pull_number: 42,
        });
        expect(result).toEqual(mockCommits);
        expect(result).toHaveLength(2);
      });

      it("should throw error when PR number is not found in context", async () => {
        const mockOctokit = {
          rest: {
            pulls: {
              listCommits: vi.fn(),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {},
        };

        await expect(
          getNewCommits(
            mockOctokit as unknown as Octokit,
            mockContext as unknown as Context,
            true,
          ),
        ).rejects.toThrowError("PR number not found in context");
      });
    });

    describe("push events", () => {
      it("should fetch commits from push when isPREvent is false", async () => {
        const mockCommits = [
          {
            sha: "xyz789",
            commit: {
              message: "Update docs",
              author: {
                name: "Bob Wilson",
                email: "bob@example.com",
                date: "2024-01-03",
              },
            },
          },
          {
            sha: "abc456",
            commit: {
              message: "Refactor utils",
              author: {
                name: "Alice Smith",
                email: "alice@example.com",
                date: "2024-01-04",
              },
            },
          },
          {
            sha: "def123",
            commit: {
              message: "Add tests",
              author: {
                name: "Charlie Brown",
                email: "charlie@example.com",
                date: "2024-01-05",
              },
            },
          },
        ];

        const mockOctokit = {
          rest: {
            repos: {
              compareCommits: vi.fn().mockResolvedValue({
                data: { commits: mockCommits },
              }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {
            before: "oldsha123",
            after: "newsha456",
          },
        };

        const result = await getNewCommits(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          false,
        );

        expect(mockOctokit.rest.repos.compareCommits).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          base: "oldsha123",
          head: "newsha456",
        });
        expect(result).toEqual(mockCommits);
        expect(result).toHaveLength(3);
      });

      it("should fetch single commit when before SHA is null (first push)", async () => {
        const mockCommit = {
          sha: "first123",
          commit: {
            message: "Initial commit",
            author: {
              name: "Alice",
              email: "alice@example.com",
              date: "2024-01-01",
            },
          },
        };

        const mockOctokit = {
          rest: {
            repos: {
              getCommit: vi.fn().mockResolvedValue({ data: mockCommit }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {
            before: null,
            after: "first123",
          },
        };

        const result = await getNewCommits(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          false,
        );

        expect(mockOctokit.rest.repos.getCommit).toHaveBeenCalledWith({
          owner: "test-owner",
          repo: "test-repo",
          ref: "first123",
        });
        expect(result).toEqual([mockCommit]);
        expect(result).toHaveLength(1);
      });

      it("should fetch single commit when before SHA is all zeros (first push)", async () => {
        const mockCommit = {
          sha: "initial456",
          commit: {
            message: "First commit",
            author: {
              name: "Charlie",
              email: "charlie@example.com",
              date: "2024-01-01",
            },
          },
        };

        const mockOctokit = {
          rest: {
            repos: {
              getCommit: vi.fn().mockResolvedValue({ data: mockCommit }),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {
            before: "0000000000000000000000000000000000000000",
            after: "initial456",
          },
        };

        const result = await getNewCommits(
          mockOctokit as unknown as Octokit,
          mockContext as unknown as Context,
          false,
        );

        expect(result).toEqual([mockCommit]);
      });

      it("should throw error when after SHA is not found in push payload", async () => {
        const mockOctokit = {
          rest: {
            repos: {
              compareCommits: vi.fn(),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {
            before: "oldsha123",
          },
        };

        await expect(
          getNewCommits(
            mockOctokit as unknown as Octokit,
            mockContext as unknown as Context,
            false,
          ),
        ).rejects.toThrowError("After SHA not found in push payload");
      });
    });

    describe("error handling", () => {
      it("should throw error when API call fails for PR", async () => {
        const mockOctokit = {
          rest: {
            pulls: {
              listCommits: vi
                .fn()
                .mockRejectedValue(new Error("API rate limit exceeded")),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: { pull_request: { number: 42 } },
        };

        await expect(
          getNewCommits(
            mockOctokit as unknown as Octokit,
            mockContext as unknown as Context,
            true,
          ),
        ).rejects.toThrowError("API rate limit exceeded");
      });

      it("should throw error when API call fails for push", async () => {
        const mockOctokit = {
          rest: {
            repos: {
              compareCommits: vi
                .fn()
                .mockRejectedValue(new Error("Network error")),
            },
          },
        };

        const mockContext = {
          repo: { owner: "test-owner", repo: "test-repo" },
          payload: {
            before: "oldsha123",
            after: "newsha456",
          },
        };

        await expect(
          getNewCommits(
            mockOctokit as unknown as Octokit,
            mockContext as unknown as Context,
            false,
          ),
        ).rejects.toThrowError("Network error");
      });
    });
  });
});
