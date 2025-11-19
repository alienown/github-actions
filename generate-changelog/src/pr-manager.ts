import { GithubContext, OctokitInstance } from "./types";

/**
 * Create or update Pull Request with changelog changes
 */
export async function createOrUpdatePR(
  octokit: OctokitInstance,
  context: GithubContext,
  changelogPath: string,
  updatedContent: string,
  prNumber: number | null,
  isUpdate: boolean,
) {
  const { owner, repo } = context.repo;

  // Get base branch from API
  let baseBranch: string;

  if (isUpdate && prNumber) {
    // Update existing PR by committing to its branch
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    baseBranch = pr.base.ref;
    const branchName = pr.head.ref;

    // Get the current file SHA from the branch
    let fileSha: string | undefined = undefined;
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: changelogPath,
        ref: branchName,
      });

      // Type guard to check if fileData is a file (not an array or directory)
      if ("sha" in fileData && !Array.isArray(fileData)) {
        fileSha = fileData.sha;
      }
    } catch {
      // File doesn't exist yet in this branch
      console.log("CHANGELOG.md does not exist in PR branch, will create it");
    }

    // Update or create file in PR branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: changelogPath,
      message: "chore: update CHANGELOG.md",
      content: Buffer.from(updatedContent).toString("base64"),
      branch: branchName,
      sha: fileSha,
    });

    console.log(`✅ Updated CHANGELOG.md in PR #${prNumber}`);
    return prNumber;
  } else {
    // Create new PR with changelog
    // Get the default branch from the repository
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    });
    baseBranch = repoData.default_branch;

    const branchName = `changelog-${Date.now()}`;

    // Get the base branch's latest commit SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });
    const baseSha = refData.object.sha;

    // Create new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });

    // Get file SHA if it exists
    let fileSha: string | undefined = undefined;
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: changelogPath,
        ref: baseBranch,
      });

      // Type guard to check if fileData is a file (not an array or directory)
      if ("sha" in fileData && !Array.isArray(fileData)) {
        fileSha = fileData.sha;
      }
    } catch {
      // File doesn't exist
      console.log("CHANGELOG.md does not exist in base branch, will create it");
    }

    // Create or update CHANGELOG.md in new branch
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: changelogPath,
      message: "chore: update CHANGELOG.md",
      content: Buffer.from(updatedContent).toString("base64"),
      branch: branchName,
      sha: fileSha,
    });

    // Create PR
    const { data: newPR } = await octokit.rest.pulls.create({
      owner,
      repo,
      title: "Update CHANGELOG.md",
      head: branchName,
      base: baseBranch,
      body: `This PR updates the CHANGELOG.md file with recent changes.\n\nGenerated automatically by changelog-generator action.`,
    });

    console.log(`✅ Created PR #${newPR.number} with CHANGELOG.md updates`);
    return newPR.number;
  }
}
