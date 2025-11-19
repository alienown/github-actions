# GitHub Actions - Reusable Composite Actions

Repository containing reusable GitHub Actions for use across different projects.

## Available Actions

### 📝 Generate Changelog with AI

Automatically generates CHANGELOG.md entries using AI based on git commit messages.

**[📖 Full Documentation](./generate-changelog/README.md)**

```yaml
- uses: alienown/github-actions/generate-changelog@v1
  with:
    openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    version-file: 'package.json'
```

## Repository Structure

```
github-actions/
├── action-1/
│   ├── action.yml
│   ├── src/
│   └── README.md
├── action-2/
│   ├── action.yml
│   ├── src/
│   └── README.md
└── README.md
```

Each action is in a separate directory with its own `action.yml` and documentation.

## License

MIT
