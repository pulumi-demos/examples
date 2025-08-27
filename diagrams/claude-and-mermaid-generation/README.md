# Diagramming Patterns with Auto-Updates

This repository demonstrates automated diagram generation using GitHub Actions and Claude Code. When pull requests are opened or updated, Claude automatically updates Mermaid diagrams to reflect infrastructure changes.

## Setup Requirements

### 1. Claude GitHub App Setup

Install the Claude GitHub App with these permissions:

1. Go to [Claude GitHub App](https://github.com/apps/claude-code)
2. Click "Install" and select your repository
3. Grant these repository permissions:
   - ✅ **Pull requests**: Read and write
   - ✅ **Issues**: Read and write
   - ✅ **Contents**: Read and write
   - ✅ **Actions**: Read (for CI results)

### 2. GitHub Secrets

Add these secrets to your repository settings (`Settings` → `Secrets and variables` → `Actions`):

- **`ANTHROPIC_API_KEY`**: Your Claude API key from [Anthropic Console](https://console.anthropic.com/)
- **`PERSONAL_ACCESS_TOKEN`**: GitHub Fine-grained Personal Access Token with permissions:
  - `pull_requests` (Read and write access to pull requests)
- **`PULUMI_ACCESS_TOKEN`**: Your Pulumi access token (if using Pulumi infrastructure)

### 3. Personal Access Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Click "Generate new token"
3. Select your repository and set expiration
4. Under "Repository permissions", grant:
   - ✅ **Pull requests**: Read and write
5. Copy the token and add it as `PERSONAL_ACCESS_TOKEN` secret

### 4. Repository Permissions

Ensure your repository has these workflow permissions:

- Go to `Settings` → `Actions` → `General`
- Under "Workflow permissions", select "Read and write permissions"
- Check "Allow GitHub Actions to create and approve pull requests"

## How It Works

### Automatic Workflow

1. **PR opened** → `auto-pr-comment.yml` runs
2. **Comment created** with "@claude update the diagrams to reflect any infrastructure changes."
3. **Claude triggered** via `claude.yml` workflow
4. **Diagrams updated** automatically based on infrastructure changes

### Manual Trigger

Comment `@claude` on any PR or issue to manually trigger diagram updates.

## Supported Diagrams

The system generates these Mermaid diagrams in the `/diagrams` folder:

- `c4-context.mmd` → Context diagram
- `c4-container.mmd` → Container diagram
- `c4-component.mmd` → Component diagram
- `aws-infrastructure.mmd` → Infrastructure diagram

Each `.mmd` file is automatically converted to `.svg` format.

## Commands Available to Claude

Claude has permission to run these commands:

- `npm install` - Install dependencies
- `pulumi preview --json` - Get infrastructure details
- `npx mmdc` - Generate SVG diagrams from Mermaid files

## File Structure

```
.github/workflows/
├── auto-pr-comment.yml    # Auto-comments on PRs
└── claude.yml             # Claude Code integration

diagrams/
├── *.mmd                  # Mermaid diagram sources
└── *.svg                  # Generated diagram images

puppeteer-config.json      # Mermaid CLI configuration
```

## Troubleshooting

### Comments not triggering Claude

- Verify `PERSONAL_ACCESS_TOKEN` is set correctly
- Check workflow permissions are "Read and write"
- Ensure fine-grained token has `pull_requests` permission

### Claude not responding

- Verify `ANTHROPIC_API_KEY` is valid
- Check workflow runs in Actions tab for error messages
- Ensure repository has required permissions

### Diagram generation fails

- Check that `puppeteer-config.json` exists
- Verify Mermaid syntax in `.mmd` files
- Review Claude's error messages in workflow logs
