# Infrastructure Feature Flagging with Pulumi ESC

This repository demonstrates how to use [Pulumi ESC (Environment, Secrets, and Configuration)](https://www.pulumi.com/docs/esc/) as a feature flag system for infrastructure. It shows how to dynamically control infrastructure behavior by updating ESC environment values, with automatic propagation of changes to dependent stacks via webhooks.

## Overview

Traditional feature flags are used in application code to toggle features on/off. This approach applies the same concept to infrastructure-as-code:

- **ESC Environment** serves as the "feature flag configuration"
- **Infrastructure code** reads flags from ESC and conditionally provisions resources
- **Webhook automation** automatically updates stacks when flags change

## Architecture

```
ESC Environment (config)
  └─ enableInternetAccess: true/false
         │
         ├─> flaggable-infra stack (reads flag, provisions VPC conditionally)
         │
         └─> Webhook Handler (monitors ESC changes)
                 └─> Triggers stack updates automatically
```

## Repository Structure

### `/esc-with-webhook-for-updating`

The automation layer that creates and monitors the ESC environment:

- **ESC Environment**: Creates a Pulumi ESC environment with feature flag configuration
- **Webhook Handler**: AWS Lambda function that listens for ESC environment changes
- **API Gateway**: HTTP endpoint to receive webhook events from Pulumi Cloud
- **Secrets Manager**: Securely stores Pulumi access token for API operations

When the ESC environment is updated, the webhook automatically triggers updates for all stacks that import that environment.

[See detailed documentation →](./esc-with-webhook-for-updating/README.md)

### `/flaggable-infra`

Sample infrastructure that demonstrates feature-flagged resources:

- Creates an AWS VPC with a private subnet (always)
- Conditionally creates internet access resources based on `enableInternetAccess` flag:
  - Internet Gateway
  - Public subnet
  - Route tables and routes

The stack imports the ESC environment and reads the `enableInternetAccess` configuration value to determine what to provision.

## How It Works

### 1. Initial Setup

Deploy the webhook infrastructure:

```bash
cd esc-with-webhook-for-updating
pulumi config set --secret pulumiAccessToken <your-token>
pulumi up
```

This creates:
- An ESC environment named `config` with initial flag values
- A webhook that listens for changes to that environment
- All necessary AWS infrastructure to handle webhook events

### 2. Deploy Flagged Infrastructure

Deploy the sample infrastructure stack:

```bash
cd flaggable-infra
pulumi up
```

The stack imports the ESC environment and provisions resources based on the `enableInternetAccess` flag.

### 3. Toggle the Feature Flag

Update the ESC environment to change the flag:

```bash
pulumi env edit <org>/config
```

Modify the `enableInternetAccess` value from `'true'` to `'false'` (or vice versa).

### 4. Automatic Update

When you save the ESC environment changes:

1. Pulumi Cloud sends a webhook event to the API Gateway endpoint
2. The Lambda function processes the event
3. The function identifies all stacks using that environment (including `flaggable-infra`)
4. The function triggers a deployment for each dependent stack
5. The infrastructure automatically updates to match the new flag value

## Use Cases

This pattern is useful for:

- **Gradual rollouts**: Enable infrastructure features for specific environments first
- **Cost optimization**: Disable expensive resources (NAT gateways, load balancers) when not needed
- **Testing**: Easily toggle between different infrastructure configurations
- **Compliance**: Quickly disable features that violate new compliance requirements
- **Emergency response**: Rapidly modify infrastructure in response to incidents

## Example: Internet Access Feature Flag

The sample infrastructure demonstrates toggling internet access for a VPC:

**When `enableInternetAccess: 'true'`:**
- VPC with private subnet
- Internet Gateway
- Public subnet
- Route tables configured for internet access

**When `enableInternetAccess: 'false'`:**
- VPC with private subnet only
- No internet gateway
- No public subnet
- Isolated network environment

## Key Benefits

1. **Centralized Configuration**: Feature flags stored in ESC, shared across stacks
2. **Automatic Propagation**: Webhook ensures dependent stacks update automatically
3. **Audit Trail**: All ESC environment changes are tracked in Pulumi Cloud
4. **Secure**: Pulumi access token stored in AWS Secrets Manager, minimal IAM permissions
5. **Scalable**: Single ESC environment can control multiple stacks

## Prerequisites

- Pulumi CLI installed
- AWS account and credentials configured
- Pulumi Cloud account (for ESC and webhooks)
- Node.js 20.x or later

## Configuration

The ESC environment (created by `esc-with-webhook-for-updating`) contains:

```yaml
values:
  pulumiConfig:
    enableInternetAccess: 'true'
    aws:region: us-east-1
```

Stacks that import this environment can access these values via `pulumi.Config()`.

## Monitoring

Monitor webhook execution via CloudWatch Logs:

```bash
aws logs tail /aws/lambda/escWebhookHandler --follow
```

The webhook logs show:
- Which ESC environment changed
- Which stacks were identified as dependencies
- Success/failure of triggered deployments

## Cleanup

Remove the sample infrastructure:

```bash
cd flaggable-infra
pulumi destroy
```

Remove the webhook infrastructure:

```bash
cd esc-with-webhook-for-updating
pulumi destroy
```

## Extending This Pattern

To add more feature flags:

1. Update the ESC environment YAML with new configuration values
2. Reference those values in your infrastructure code via `config.get*()`
3. Use conditional logic to provision/skip resources based on flag values

To connect more stacks:

1. Import the ESC environment in your stack configuration (Pulumi.yaml)
2. The webhook will automatically discover and update your stack when flags change

## Learn More

- [Pulumi ESC Documentation](https://www.pulumi.com/docs/esc/)
- [Pulumi Webhooks](https://www.pulumi.com/docs/pulumi-cloud/webhooks/)
- [Pulumi Deployments API](https://www.pulumi.com/docs/pulumi-cloud/deployments/)
