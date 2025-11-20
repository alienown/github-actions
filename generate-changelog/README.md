# Generate Changelog with AI

Automatically generates CHANGELOG.md entries using AI based on git commit messages.

## Features

- Creates CHANGELOG.md file if it doesn't exist
- Analyzes git commit messages and generates human-readable descriptions in natural language
- Commits updated CHANGELOG.md directly to PR branch when new commits are added
- Creates new PR with CHANGELOG.md when commits go directly to main/master
- Supports manual workflow dispatch to update changelog for specific PRs
- Appends new changes to existing version section if it already exists
- Uses OpenRouter API for AI-powered changelog generation
- Supports multiple version file formats (package.json, plain text)

## Usage

### In Pull Request workflow

```yaml
name: Update Changelog

on:
  pull_request:
    types: [opened, synchronize]
    branches:
      - main
      - master

jobs:
  changelog:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate Changelog
        uses: alienown/github-actions/generate-changelog@v1
        with:
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          version-file: 'package.json'
          ai-model: 'openai/gpt-4o-mini'  # optional
```

### For direct push to main

```yaml
name: Update Changelog on Push

on:
  push:
    branches:
      - main
      - master

jobs:
  changelog:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate Changelog
        uses: alienown/github-actions/generate-changelog@v1
        with:
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          version-file: 'package.json'
```

### Manual workflow dispatch

You can manually trigger changelog generation for a specific PR:

```yaml
name: Generate Changelog

on:
  workflow_dispatch:
    inputs:
      pr-number:
        description: 'Pull request number to generate changelog for'
        required: true
        type: number

jobs:
  changelog:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Generate Changelog
        uses: alienown/github-actions/generate-changelog@v1
        with:
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          version-file: 'package.json'
          pr-number: ${{ inputs.pr-number }}
```

To use: Go to Actions tab → Select workflow → Run workflow → Enter PR number

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|------|
| `openrouter-api-key` | OpenRouter API key | ✅ Yes | - |
| `github-token` | GitHub token with repo write permissions | ✅ Yes | `${{ github.token }}` |
| `version-file` | Path to file containing version (supports: single-line version text file or `package.json`) | ✅ Yes | - |
| `pr-number` | Pull request number to update (used with workflow_dispatch event) | ❌ No | - |
| `ai-model` | OpenRouter AI model to use for changelog generation | ❌ No | `openai/gpt-4o-mini` |
| `changelog-path` | Path to CHANGELOG.md file | ❌ No | `CHANGELOG.md` |

## Outputs

| Output | Description |
|--------|-------------|
| `changelog-updated` | Whether the changelog was updated (`true`/`false`) |
| `pr-number` | Pull request number that was created/updated |

## Required Permissions

Add these permissions to your workflow:

```yaml
permissions:
  contents: write      # to commit changes
  pull-requests: write # to create/update PRs
```

## Required Secrets

1. **OPENROUTER_API_KEY** - API key from [OpenRouter](https://openrouter.ai/)
   - Add in Settings → Secrets and variables → Actions → New repository secret

2. **GITHUB_TOKEN** - Automatically available in Actions, only requires proper permissions

## How It Works

1. **Pull Request**: When you open a PR or add new commits, the action:
   - Fetches all commits from the PR (maximum 250 commits)
   - Reads the version from your specified version file
   - Sends commit messages and version info to AI to generate a changelog entry
   - Commits the updated CHANGELOG.md directly to the PR branch
   - If an entry for the current version already exists, new changes are appended to that section

2. **Direct Push**: When commits go directly to main/master:
   - Fetches new commits from the push event
   - For first push to branch, uses only the latest commit
   - For subsequent pushes, compares before/after SHAs to get all new commits
   - Reads the version from your specified version file
   - Sends commit messages to AI to generate a changelog entry
   - Creates a new branch and PR with the updated CHANGELOG.md
   - If an entry for the current version already exists, new changes are appended to that section

3. **Workflow Dispatch**: When manually triggered with a PR number:
   - Fetches all commits from the specified PR (maximum 250 commits)
   - Reads the version from your specified version file
   - Sends commit messages and version info to AI to generate a changelog entry
   - Commits the updated CHANGELOG.md directly to the specified PR branch
   - If an entry for the current version already exists, new changes are appended to that section
   - Useful for regenerating changelog for existing PRs or when automatic triggers didn't run

## Version File Format

The action supports two version file formats:

### 1. package.json
Standard Node.js package file with version field:
```json
{
  "name": "my-project",
  "version": "1.0.0"
}
```

### 2. Single-line text file (version.txt)
Plain text file containing only the version number on the first line:
```
1.0.0
```

Any content after the first line is ignored.

**Important:** 
- Version must not be empty
- The action accepts any version format your project uses (semantic versioning, date-based, etc.)
- For package.json, the file must contain valid JSON with a `version` field

## Example CHANGELOG.md

```markdown
# Changelog

## 1.0.0

- Added new user authentication feature with OAuth2 support
- Fixed critical bug in form validation that prevented submissions
- Improved API documentation with more examples
- Enhanced unit test coverage for authentication module

## 0.9.0

- Improved application performance by optimizing database queries
- Fixed minor UI alignment issues in the dashboard
- Added dark mode support across all pages
- Updated dependencies to latest stable versions
```

## AI Models

You can use different models from OpenRouter, e.g.:
- `openai/gpt-4o-mini` (default, cheaper)
- `openai/gpt-4o`
- `anthropic/claude-3.5-sonnet`
- `google/gemini-pro-1.5`

See full list: https://openrouter.ai/models

## Development

### Project Structure

```
generate-changelog/
├── action.yml              # GitHub Action definition
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Main entry point
│   ├── changelog-generator.ts  # OpenRouter AI communication
│   ├── git-utils.ts       # Fetching commits from GitHub
│   ├── file-utils.ts      # CHANGELOG.md file operations
│   ├── pr-manager.ts      # Pull Request creation/update
│   ├── version-utils.ts   # Version file parsing
│   └── types.ts           # TypeScript type definitions
├── tests/
│   ├── file-utils.test.ts
│   ├── git-utils.test.ts
│   ├── pr-manager.test.ts
│   └── version-utils.test.ts
└── README.md
```

### Build and Test

```bash
# Install dependencies
npm install

# Build the action
npm run build

# Run tests
npm test

# Format code
npm run format

# Lint code
npm run lint
```

## License

MIT
