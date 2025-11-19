import { OpenRouter } from "@openrouter/sdk";

export type Commit = {
  message: string;
};

/**
 * Create a prompt for refining an existing changelog entry
 */
function createRefinementPrompt(
  version: string,
  commitMessages: string,
  currentVersionContent: string,
): string {
  return `You are a technical writer refining a CHANGELOG entry for a software project. You will improve the existing changelog content by incorporating new git commit messages, ensuring clarity, conciseness, and relevance.

PROJECT VERSION: ${version}

CURRENT CHANGELOG CONTENT FOR THIS VERSION:
${currentVersionContent}

NEW GIT COMMITS TO ADD:
${commitMessages}

REFINE the changelog entry by:
1. MUST start with a version header in format: ## ${version}
2. Review the existing changelog content and incorporate the new commits
3. Merge similar changes to avoid duplication
4. Maintain chronological order (newer changes first)
5. Use bullet points (-) for each change
6. Write in natural language (not just a list of commits)
7. Group related changes together when possible
8. Focus on user-facing changes and impacts
9. Use clear, simple language
10. Start directly with the version header (no "Here is..." or similar preambles)

Example format:
## ${version}

- Added new user authentication feature with OAuth2 support
- Fixed critical bug in form validation that prevented submissions
- Improved API documentation with more examples

Format the output exactly as shown above, ready to be inserted into CHANGELOG.md.`;
}

/**
 * Create a prompt for generating a new changelog entry
 */
function createNewEntryPrompt(version: string, commitMessages: string): string {
  return `You are a technical writer creating a CHANGELOG entry for a software project. You will generate a concise and clear changelog based on the provided git commit messages.

PROJECT VERSION: ${version}

GIT COMMITS:
${commitMessages}

Generate a human-readable, concise changelog entry that:
1. MUST start with a version header in format: ## ${version}
2. Use bullet points (-) for each change
3. Write in natural language (not just a list of commits)
4. Summarize what was changed, added, fixed, or improved
5. Group related changes together when possible
6. Focus on user-facing changes and impacts
7. Use clear, simple language
8. Start directly with the version header (no "Here is..." or similar preambles)

Example format:
## ${version}

- Added new user authentication feature with OAuth2 support
- Fixed critical bug in form validation that prevented submissions
- Improved API documentation with more examples

Format the output exactly as shown above, ready to be inserted into CHANGELOG.md.`;
}

/**
 * Generate human-readable changelog entry using OpenRouter AI
 */
export async function generateChangelogEntry(
  commits: Commit[],
  version: string,
  openrouterApiKey: string,
  aiModel: string,
  currentVersionContent: string | null = null,
) {
  const commitMessages = commits
    .map((commit) => {
      const message = commit.message;
      return `- ${message}`;
    })
    .join("\n");

  const hasExistingContent =
    currentVersionContent && currentVersionContent.trim().length > 0;

  const prompt = hasExistingContent
    ? createRefinementPrompt(version, commitMessages, currentVersionContent)
    : createNewEntryPrompt(version, commitMessages);

  try {
    const client = new OpenRouter({
      apiKey: openrouterApiKey,
    });

    const response = await client.chat.send({
      model: aiModel,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0].message.content;

    if (!content) {
      throw new Error("No content received from OpenRouter AI");
    }

    const changelog =
      typeof content === "string"
        ? content
        : content[0].type === "text"
          ? content[0].text
          : "";

    if (!changelog) {
      throw new Error("No valid changelog content received from OpenRouter AI");
    }

    return changelog;
  } catch (error) {
    console.error("Error generating changelog with AI:", error);
    throw error;
  }
}
