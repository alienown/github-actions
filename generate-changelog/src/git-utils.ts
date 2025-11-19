import { GithubContext, OctokitInstance } from "./types";
import { PushEvent, PullRequestEvent } from "@octokit/webhooks-types";

/**
 * Get new commits that need to be included in changelog
 */
export async function getNewCommits(
  octokit: OctokitInstance,
  context: GithubContext,
  isPREvent: boolean,
) {
  const { owner, repo } = context.repo;

  try {
    if (isPREvent) {
      // Get commits from the PR
      const payload = context.payload as PullRequestEvent;
      const prNumber = payload.pull_request?.number;
      if (!prNumber) {
        throw new Error("PR number not found in context");
      }

      // INFO: this function lists maximum 250 commits;
      const { data } = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
      });

      return data;
    } else {
      // Direct push to main/master - get commits from the push
      const payload = context.payload as PushEvent;
      const beforeSha = payload.before;
      const afterSha = payload.after;

      if (!afterSha) {
        throw new Error("After SHA not found in push payload");
      }

      if (
        !beforeSha ||
        beforeSha === "0000000000000000000000000000000000000000"
      ) {
        // First push to branch, get last commit only
        const { data } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: afterSha,
        });

        return [data];
      }

      // Compare commits
      const { data } = await octokit.rest.repos.compareCommits({
        owner,
        repo,
        base: beforeSha,
        head: afterSha,
      });

      return data.commits;
    }
  } catch (error) {
    console.error("Error fetching commits:", error);
    throw error;
  }
}
