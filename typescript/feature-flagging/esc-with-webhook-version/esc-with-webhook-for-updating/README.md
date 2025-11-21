# ESC Environment Webhook

This Pulumi project creates a webhook system that automatically updates stacks when their ESC (Environment, Secrets, and Configuration) environment changes.

## Architecture

- **AWS Lambda**: Handles webhook events from Pulumi Cloud
- **API Gateway**: Exposes the webhook endpoint
- **AWS Secrets Manager**: Securely stores the Pulumi access token
- **IAM Roles**: Provides necessary permissions for Lambda execution

## Components

1. **ESC Environment** (`flaggingEnv`): The Pulumi ESC environment being monitored
2. **Webhook Handler** (`webhook-handler.ts`): Lambda function that processes webhook events
3. **API Gateway**: HTTP API endpoint that receives webhook notifications
4. **Secrets Manager**: Stores Pulumi access token securely
5. **Pulumi Webhook**: Automatically configured to listen for environment revision events

## Setup

### 1. Configure Pulumi

Set your Pulumi access token as a secret:

```bash
pulumi config set --secret pulumiAccessToken <your-pulumi-access-token>
```

### 2. Deploy

Deploy the infrastructure:

```bash
pulumi up
```

The deployment will automatically:
- Create the Lambda function and API Gateway
- Configure the webhook in Pulumi Cloud to listen for `environment_revision_created` events
- Set up all necessary permissions and secrets

## How It Works

1. When an ESC environment is updated in Pulumi Cloud, a webhook event is sent to the API Gateway endpoint
2. API Gateway triggers the Lambda function
3. The Lambda function:
   - Retrieves the Pulumi access token from Secrets Manager
   - Queries all stacks in the organization
   - Identifies stacks that import the modified ESC environment
   - Triggers an update deployment for each dependent stack
4. The Lambda function returns a summary of the operations

## Webhook Event Format

The webhook receives events with this structure:

```json
{
  "timestamp": 1234567890,
  "version": "1",
  "kind": "environment.updated",
  "organization": {
    "githubLogin": "org-name",
    "name": "Organization Name",
    "avatarUrl": "https://..."
  },
  "environment": {
    "name": "config",
    "modified": 1234567890
  },
  "user": {
    "name": "User Name",
    "githubLogin": "username",
    "avatarUrl": "https://..."
  },
  "projectName": "featureflagging"
}
```

## Response Format

The webhook responds with:

```json
{
  "message": "Processed ESC environment change for config",
  "stacksFound": 2,
  "updatesTriggered": 2,
  "updatesFailed": 0,
  "stacks": ["project1/stack1", "project2/stack2"]
}
```

## Environment Variables

The Lambda function uses these environment variables:

- `PULUMI_ACCESS_TOKEN_SECRET`: ARN of the Secrets Manager secret containing the Pulumi token
- `PROJECT_NAME`: Default project name (defaults to "featureflagging")

## Monitoring

Check CloudWatch Logs for the Lambda function to monitor webhook processing:

```bash
aws logs tail /aws/lambda/escWebhookHandler --follow
```

## Security

- Pulumi access token is stored encrypted in AWS Secrets Manager
- Lambda function has minimal IAM permissions (read secret, write logs)
- API Gateway endpoint is public but validates webhook payload structure

## Cleanup

To remove all resources:

```bash
pulumi destroy
```
