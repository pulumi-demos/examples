# Native Pulumi Diagramming Capabilities

This example demonstrates Pulumi's built-in architecture diagramming capabilities using the `pulumi stack graph` command. It creates AWS infrastructure (VPC, subnets, gateways, and S3 bucket) and automatically generates architecture diagrams on every deployment via GitHub Actions.

## How It Works

This project showcases Pulumi's native ability to generate architecture diagrams from your infrastructure code without requiring external tools or AI services. The GitHub Actions workflow automatically:

1. Deploys the Pulumi infrastructure
2. Generates a DOT graph file using `pulumi stack graph`  
3. Converts the DOT file to PNG format using Graphviz
4. Uploads both formats as GitHub Actions artifacts

## Architecture Created

The Pulumi program creates:

- **VPC** with DNS support (10.29.0.0/16)
- **Public subnets** (10.29.1.0/24, 10.29.2.0/24) with auto-assign public IPs
- **Private subnet** (10.29.10.0/24)
- **Internet Gateway** for public internet access
- **NAT Gateway** with Elastic IP for private subnet internet access
- **Route tables** connecting subnets to appropriate gateways
- **S3 bucket** for storage

## Prerequisites

- Pulumi CLI (>= v3): https://www.pulumi.com/docs/get-started/install/
- Node.js (>= 14): https://nodejs.org/
- AWS credentials configured (e.g., via `aws configure` or environment variables)


## Finding Generated Diagrams

### In GitHub Actions

When code is pushed to the `main` branch, diagrams are automatically generated and stored as GitHub Actions artifacts:

1. Go to your repository's **Actions** tab
2. Click on the latest "Pulumi Deploy & Diagram" workflow run
3. Scroll down to the **Artifacts** section
4. Download the `architecture-diagrams` artifact
5. Extract the ZIP file to find:
   - `architecture.dot` - DOT graph source file
   - `architecture.png` - Visual diagram image

### Locally

Run the diagram generation commands manually:

```bash
# Generate DOT file
pulumi stack graph architecture.dot

# Install Graphviz (if not already installed)
# macOS: brew install graphviz
# Ubuntu: sudo apt-get install graphviz

# Convert to PNG
dot -Tpng architecture.dot -o architecture.png
```

## Project Structure

```
.github/workflows/
└── pulumi-preview.yml     # Automated deployment & diagram generation

index.ts                   # Main Pulumi program
Pulumi.yaml               # Project configuration
package.json              # Dependencies
tsconfig.json             # TypeScript configuration
```

## GitHub Actions Workflow

The `.github/workflows/pulumi-preview.yml` workflow:

1. **Deploys** infrastructure using Pulumi Actions
2. **Generates** DOT graph with `pulumi stack graph`
3. **Converts** DOT to PNG using Graphviz
4. **Uploads** both formats as downloadable artifacts

## Repository Setup

To use this example in your own repository:

1. **Fork/copy** this repository
2. **Add repository secrets**:
   - `PULUMI_ACCESS_TOKEN` - Your Pulumi access token from [Pulumi Console](https://app.pulumi.com/)
3. **Push to main branch** to trigger automatic diagram generation
4. **Check Actions tab** for generated diagram artifacts

## Benefits of Native Diagramming

- **No external dependencies** - Uses Pulumi's built-in capabilities
- **Always accurate** - Diagrams reflect actual deployed infrastructure  
- **Automatic updates** - Regenerated on every deployment
- **Multiple formats** - DOT source + PNG visual output
- **CI/CD integration** - Seamlessly integrates with existing workflows

## Clean Up

```bash
pulumi destroy
pulumi stack rm dev
```