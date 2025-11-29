import { OpenRouter } from "@openrouter/sdk";

export type Commit = {
  message: string;
};

/**
 * Common formatting guidelines for changelog entries
 */
function getChangelogGuidelines(
  version: string,
  isNewEntryPrompt: boolean,
): string {
  const examples = isNewEntryPrompt
    ? `
### Example: Generating a new changelog entry with functional changes only
**Current Version:** 1.0.0
**Commit messages:**
- feat: add login page
- fix: login button color
- docs: update readme
**Expected output:**
## 1.0.0

- Added login page functionality.
- Fixed login button color consistency.

### Example: Generating a new minimal changelog entry summarizing changes when no functional changes are present
**Current Version:** 1.0.1
**Commit messages:**
- chore: update dependencies
- test: add unit tests
**Expected output:**
## 1.0.1

- Updated dependencies and added unit tests.

### Example: Consolidating similar changes into a single bullet point
**Current Version:** 1.0.1
**Commit messages:**
- feat: fix styling on dashboard
- fix: correct dashboard layout issues
- style: improve dashboard CSS
- fix: ef core query optimization
**Expected output:**
## 1.0.1

- Improved dashboard styling and layout.
- Optimized EF Core queries.`
    : `
### Example: Incorporating functional changes into existing changelog preserving order (new git commits are newer than changes from existing content)
**Current Version:** 1.0.0
**Current Version Content:**
- Added login page functionality.
- Fixed bad request error when submitting forms
**Commit messages:**
- feat: add feedback button on home page
- fix: styling issues on my account page
**Expected output:**
## 1.0.0

- Added feedback button on home page.
- Fixed styling issues on my account page.
- Added login page functionality.
- Fixed bad request error when submitting forms.

### Example: Refining existing changelog with style adjustments when no functional changes are present in new commits
**Current Version:** 1.0.0
**Current Version Content:**
Added login page functionality.
- Bad request error fix when submitting forms
**Commit messages:**
- chore: fix typos in comments
**Expected output:**
## 1.0.0

- Added login page functionality.
- Bad request error fix when submitting forms.

### Example: Consolidating similar changes into a single bullet point (merging across new commits and current changelog content)
**Current Version:** 1.5.0
**Current Version Content:**
- Added email notifications for order updates.
- Improved dashboard load time.
**Commit messages:**
- feat: add SMS notifications for order updates
- feat: add push notifications for order updates
**Expected output:**
## 1.5.0

- Added email, SMS, and push notifications for order updates.
- Improved dashboard load time.`;

  return `
FORMAT GUIDELINES:
1. MUST start with a version header in format: ## ${version}
2. Use bullet points (-) for each change
3. End each bullet point with a period

STYLE GUIDELINES:
1. Start directly with the version header (no "Here is..." or similar preambles)
2. Write in natural language (not just a list of commits)
3. Group related changes together when possible
4. Use simple language, be concise and clear, make each word count

CONTENT GUIDELINES:
1. Focus on user-facing changes and impacts
2. Include ONLY functional changes (new features, bug fixes, improvements, breaking changes)
3. EXCLUDE bureaucratic changes such as: test updates, documentation adjustments, code formatting, linting changes, regenerating dist files, or internal refactoring that doesn't affect functionality.${isNewEntryPrompt ? ' If no functional changes are present, add a short entry summarizing what was done (e.g., "- Test coverage increased and code formatting applied.")' : " If no new functional changes were introduced, retain the existing content as is, eventually adjusting it to adhere to the formatting, style, and content guidelines."}
4. ALWAYS merge similar or related changes into a single bullet point - this includes merging new commits with existing content when they relate to the same feature or area (e.g., multiple OAuth2 provider additions should become one bullet point listing all providers)
5. Maintain chronological order - entries should reflect the order of commits.${!isNewEntryPrompt ? ' "New git commits to add" are newer than existing content, meaning they should be higher in the changelog.' : ""}

EXAMPLES:
${examples}

Format the output exactly as shown in the expected output of the examples above, ready to be inserted into CHANGELOG.md.`;
}

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

${getChangelogGuidelines(version, false)}`;
}

/**
 * Create a prompt for generating a new changelog entry
 */
function createNewEntryPrompt(version: string, commitMessages: string): string {
  return `You are a technical writer creating a CHANGELOG entry for a software project. You will generate a cohesive, concise, and clear changelog based on the provided git commit messages and existing changelog content.

PROJECT VERSION: ${version}

GIT COMMITS:
${commitMessages}

${getChangelogGuidelines(version, true)}`;
}

export function createPrompt(
  version: string,
  commitMessages: string,
  currentVersionContent: string | null = null,
): string {
  if (currentVersionContent && currentVersionContent.trim().length > 0) {
    return createRefinementPrompt(
      version,
      commitMessages,
      currentVersionContent,
    );
  } else {
    return createNewEntryPrompt(version, commitMessages);
  }
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

  const prompt = createPrompt(version, commitMessages, currentVersionContent);

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

    return changelog.trim();
  } catch (error) {
    console.error("Error generating changelog with AI:", error);
    throw error;
  }
}
