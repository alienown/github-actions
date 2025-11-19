import * as core from "@actions/core";
import * as github from "@actions/github";
import { generateChangelogEntry } from "./changelog-generator.js";
import { getNewCommits } from "./git-utils.js";
import { buildChangelogContent, readChangelogVersionSection } from "./file-utils.js";
import { createOrUpdatePR } from "./pr-manager.js";
import { readVersionFromFile } from "./version-utils.js";

async function run() {
  try {
    // Get inputs
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;
    const aiModel = process.env.AI_MODEL || "openai/gpt-4o-mini";
    const changelogPath = process.env.CHANGELOG_PATH || "CHANGELOG.md";
    const versionFile = process.env.VERSION_FILE;

    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required");
    }

    if (!githubToken) {
      throw new Error("GITHUB_TOKEN is required");
    }

    if (!versionFile) {
      throw new Error("VERSION_FILE is required");
    }

    // Read and parse version from file
    const version = await readVersionFromFile(versionFile);
    console.log(`Project version: ${version}`);

    const context = github.context;
    const octokit = github.getOctokit(githubToken);

    console.log("Event:", context.eventName);
    console.log("Ref:", context.ref);
    console.log("PR:", context.payload.pull_request?.number);

    // Determine if this is a PR event or direct push to main
    const isPREvent = context.eventName === "pull_request";
    const isDirectPush =
      context.eventName === "push" &&
      (context.ref === "refs/heads/main" ||
        context.ref === "refs/heads/master");

    if (!isPREvent && !isDirectPush) {
      console.log("Skipping: Not a PR or direct push to main/master");
      core.setOutput("changelog-updated", "false");
      return;
    }

    // Get new commits
    const commits = await getNewCommits(octokit, context, isPREvent);

    if (!commits || commits.length === 0) {
      console.log("No new commits found");
      core.setOutput("changelog-updated", "false");
      return;
    }

    console.log(`Found ${commits.length} new commits`);

    // Read current changelog section for this version
    const currentVersionContent = await readChangelogVersionSection(
      changelogPath,
      version,
    );

    // Generate changelog entry using AI
    const changelogEntry = await generateChangelogEntry(
      commits.map((commit) => ({
        message: commit.commit.message,
      })),
      version,
      openrouterApiKey,
      aiModel,
      currentVersionContent,
    );

    console.log("Generated changelog entry:\n", changelogEntry);

    // Build CHANGELOG.md content
    const updatedContent = await buildChangelogContent(
      changelogPath,
      changelogEntry,
    );

    // Handle PR creation/update
    if (isPREvent) {
      const prNumber = context.payload.pull_request?.number;
      if (!prNumber) {
        throw new Error("PR number not found in context");
      }

      // Update existing PR with changelog
      await createOrUpdatePR(
        octokit,
        context,
        changelogPath,
        updatedContent,
        prNumber,
        true, // isUpdate
      );
      core.setOutput("pr-number", prNumber.toString());
    } else if (isDirectPush) {
      // Create new PR with changelog
      const prNumber = await createOrUpdatePR(
        octokit,
        context,
        changelogPath,
        updatedContent,
        null,
        false, // isUpdate
      );
      core.setOutput("pr-number", prNumber.toString());
    }

    core.setOutput("changelog-updated", "true");
    console.log("✅ Changelog generated successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
    console.error(error);
  }
}

void run();
