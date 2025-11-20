# Changelog

## 1.1.0

- Introduced a feature to generate a changelog based on pull request numbers from the workflow dispatch event.
- Enhanced the AI changelog generator to focus solely on functional changes in commit messages.
- Improved the readability of `changelog.md` by adding an additional line break between software versions.

## 1.0.0

- AI-powered changelog generation from git commit messages using OpenRouter API
- Automatic commits to PR branches and PR creation for direct default branch pushes
- Smart appending to existing version sections
- Support for package.json and plain text version files
