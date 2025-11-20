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
    const prNumberInput = process.env.PR_NUMBER;

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

    // Determine if this is a PR event, direct push to main, or workflow_dispatch
    const isPREvent = context.eventName === "pull_request";
    const isDirectPush =
      context.eventName === "push" &&
      (context.ref === "refs/heads/main" ||
        context.ref === "refs/heads/master");
    const isWorkflowDispatch = context.eventName === "workflow_dispatch";

    if (!isPREvent && !isDirectPush && !isWorkflowDispatch) {
      console.log("Skipping: Not a PR, direct push to main/master, or workflow_dispatch");
      core.setOutput("changelog-updated", "false");
      return;
    }

    // For workflow_dispatch, PR number is required
    if (isWorkflowDispatch && !prNumberInput) {
      throw new Error("PR_NUMBER is required for workflow_dispatch event");
    }

    // Determine PR number if applicable
    let prNumber: number | undefined;
    if (isPREvent) {
      prNumber = context.payload.pull_request?.number;
      if (!prNumber) {
        throw new Error("PR number not found in context");
      }
    } else if (isWorkflowDispatch) {
      prNumber = parseInt(prNumberInput!, 10);
    }

    if (prNumber) {
      console.log(`Processing PR #${prNumber}`);
    }

    // Get new commits
    const commits = await getNewCommits(octokit, context, prNumber);

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
    if (isPREvent || isWorkflowDispatch) {
      if (!prNumber) {
        throw new Error("PR number not found");
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
