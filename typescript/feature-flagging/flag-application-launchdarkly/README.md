# Feature Flag Management with Pulumi

This project demonstrates how to manage feature flags as infrastructure-as-code using Pulumi with a Terraform provider bridge. It includes a complete example with LaunchDarkly, but the pattern works with any feature flagging system that has a Terraform provider.

## Overview

This example creates:

- A feature flag in LaunchDarkly
- Environment-specific targeting rules (Test environment)
- A rule that enables the flag for users with name "alice"
- An AWS Lambda function that evaluates the flag and returns different responses based on the flag value
- A Lambda Function URL for easy HTTP access

## Using Terraform Providers with Pulumi

Pulumi supports using any Terraform provider through its [Terraform Provider bridge](https://www.pulumi.com/registry/packages/terraform-provider/installation-configuration/). This means you can manage resources from thousands of providers that have Terraform support, including:

- **Feature Flagging**: LaunchDarkly, Statsig, Split, Flagsmith, etc.
- **Observability**: Datadog, New Relic, Grafana, etc.
- **Security**: Okta, Auth0, Vault, etc.
- **And many more**: Any provider in the Terraform Registry

### Why Use This Pattern?

1. **Infrastructure as Code**: Manage feature flags alongside your infrastructure
2. **Version Control**: Track flag configuration changes in Git
3. **Consistency**: Ensure flags are configured the same way across environments
4. **Automation**: Deploy flags as part of your CI/CD pipeline
5. **Cross-Provider**: Use the same IaC tool for cloud resources and SaaS tools

## Project Structure

```
.
├── index.ts              # Pulumi infrastructure configuration
├── lambda/
│   ├── lambda.js         # Lambda function that evaluates the flag
│   └── package.json      # Lambda runtime dependencies
├── Pulumi.yaml           # Pulumi project configuration (includes Terraform provider)
└── package.json          # Pulumi dependencies
```

## Prerequisites

- Node.js 18+
- Pulumi CLI
- AWS account and credentials configured
- LaunchDarkly account and access token

## Setup

### 1. Install Dependencies

Install root dependencies:

```bash
npm install
```

Install Lambda dependencies:

```bash
cd lambda && npm install && cd ..
```

### 2. Configure Pulumi

Set your LaunchDarkly access token (for managing flags):

```bash
pulumi config set --secret ldAccessToken <your-access-token>
```

Set your LaunchDarkly SDK key (for evaluating flags at runtime):

```bash
pulumi config set --secret ldSdkKey <your-sdk-key>
```

### 3. Deploy

```bash
pulumi up
```

The output will include a Lambda Function URL you can use to test.

## Testing the Lambda

Once deployed, test the Lambda function:

```bash
# User with name "alice" - flag will be ON
curl "<lambda-url>?userId=user1&name=alice"

# Other users - flag will be OFF
curl "<lambda-url>?userId=user2&name=bob"
```

Expected responses:

```
Hello alice! The flag is ON for you. You're special!
```

Or for other users:

```
Hello bob! The flag is OFF for you. Standard greeting.
```

## Adapting for Other Feature Flag Providers

This pattern works with any feature flagging system that has a Terraform provider. Here's how to adapt it:

### 1. Add the Terraform Provider

Use the `pulumi package add` command to add a different Terraform provider:

```bash
pulumi package add terraform-provider provider-org/provider-name x.y.z
```

This will automatically update your `Pulumi.yaml` and install the necessary bindings.

### 2. Update Your Code

Import and use the provider in your `index.ts`:

```typescript
import * as yourProvider from "@pulumi/your-provider";

const flag = new yourProvider.FeatureFlag("my-flag", {
  // Provider-specific configuration
});
```

### 3. Update Lambda SDK

Replace the LaunchDarkly SDK in `lambda/package.json` with your provider's SDK and update the evaluation logic in `lambda/lambda.js`.

## Example: Other Feature Flag Providers

Check the [Terraform Registry](https://registry.terraform.io/browse/providers) for the full list.

## How It Works

1. **Pulumi Configuration**: The `Pulumi.yaml` file configures the Terraform provider bridge, which automatically generates TypeScript bindings for the LaunchDarkly Terraform provider
2. **Infrastructure Setup**: The `index.ts` file creates the feature flag, configures targeting rules, and deploys the Lambda function
3. **Runtime Evaluation**: The Lambda function uses the LaunchDarkly SDK to evaluate the flag for each request
4. **Dynamic Responses**: Based on the flag value, the Lambda returns different messages

## Key Concepts

### Feature Flag Configuration

The flag is configured with:

- **Environment**: Test
- **Targeting Rule**: Match users where `name` attribute equals "alice"
- **Variations**:
  - `0` (true) - Returned for matched users
  - `1` (false) - Default fallthrough for everyone else

### Lambda Function

The Lambda:

1. Accepts `userId` and `name` as query parameters
2. Creates a LaunchDarkly user context with these attributes
3. Evaluates the `exampleFlag` flag for that user
4. Returns a custom message based on the flag value

## Resources

- [Pulumi Terraform Provider Bridge](https://www.pulumi.com/registry/packages/terraform-provider/installation-configuration/)
- [LaunchDarkly Terraform Provider](https://registry.terraform.io/providers/launchdarkly/launchdarkly/latest)
- [Pulumi AWS Provider](https://www.pulumi.com/registry/packages/aws/)
- [LaunchDarkly Node SDK](https://docs.launchdarkly.com/sdk/server-side/node-js)

## Clean Up

To remove all resources:

```bash
pulumi destroy
```
