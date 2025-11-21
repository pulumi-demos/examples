import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as aws from "@pulumi/aws";

// Create the ESC environment
const pulumiProv = new pulumiservice.Environment("flaggingEnv", {
  name: "config",
  project: "featureflagging",
  organization: pulumi.getOrganization(),
  yaml: new pulumi.asset.StringAsset(`values:
  pulumiConfig:
    enableInternetAccess: 'true'
    aws:region: us-east-1`),
});

// Get the Pulumi access token from config (you'll need to set this)
const config = new pulumi.Config();
const pulumiAccessToken = config.requireSecret("pulumiAccessToken");

// Store the Pulumi access token in AWS Secrets Manager
const pulumiTokenSecret = new aws.secretsmanager.Secret("pulumiTokenSecret", {
  description: "Pulumi access token for webhook handler",
  name: "pulumi-webhook-token",
});

const pulumiTokenSecretVersion = new aws.secretsmanager.SecretVersion(
  "pulumiTokenSecretVersion",
  {
    secretId: pulumiTokenSecret.id,
    secretString: pulumiAccessToken,
  }
);

// Create IAM role for Lambda
const lambdaRole = new aws.iam.Role("webhookLambdaRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
      },
    ],
  }),
});

// Attach basic Lambda execution policy
new aws.iam.RolePolicyAttachment("lambdaBasicExecution", {
  role: lambdaRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

// Create policy to allow Lambda to read the secret
const secretReadPolicy = new aws.iam.RolePolicy("secretReadPolicy", {
  role: lambdaRole.id,
  policy: pulumiTokenSecret.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["secretsmanager:GetSecretValue"],
          Resource: arn,
        },
      ],
    })
  ),
});

// Build and package the Lambda function
const lambdaFunction = new aws.lambda.Function("escWebhookHandler", {
  runtime: "nodejs20.x",
  handler: "webhook-handler.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    "webhook-handler.js": new pulumi.asset.FileAsset("./webhook-handler.js"),
  }),
  timeout: 60,
  environment: {
    variables: {
      PULUMI_ACCESS_TOKEN_SECRET: pulumiTokenSecret.arn,
      PROJECT_NAME: "featureflagging",
    },
  },
});

// Create API Gateway REST API
const api = new aws.apigatewayv2.Api("webhookApi", {
  protocolType: "HTTP",
  description: "Webhook endpoint for ESC environment changes",
});

// Create Lambda integration
const integration = new aws.apigatewayv2.Integration("webhookIntegration", {
  apiId: api.id,
  integrationType: "AWS_PROXY",
  integrationUri: lambdaFunction.arn,
  payloadFormatVersion: "2.0",
});

// Create route
const route = new aws.apigatewayv2.Route("webhookRoute", {
  apiId: api.id,
  routeKey: "POST /webhook",
  target: integration.id.apply((id) => `integrations/${id}`),
});

// Create stage
const stage = new aws.apigatewayv2.Stage("webhookStage", {
  apiId: api.id,
  name: "$default",
  autoDeploy: true,
});

// Grant API Gateway permission to invoke Lambda
const lambdaPermission = new aws.lambda.Permission("apiGatewayInvoke", {
  action: "lambda:InvokeFunction",
  function: lambdaFunction.name,
  principal: "apigateway.amazonaws.com",
  sourceArn: api.executionArn.apply((arn) => `${arn}/*`),
});

// Configure the webhook in Pulumi Cloud
const webhook = new pulumiservice.Webhook("escEnvironmentWebhook", {
  organizationName: pulumi.getOrganization(),
  displayName: "ESC Environment Change Webhook",
  payloadUrl: api.apiEndpoint.apply((endpoint) => `${endpoint}/webhook`),
  active: true,
  filters: ["environment_revision_created"],
});

// Export the webhook URL
export const webhookUrl = api.apiEndpoint.apply(
  (endpoint) => `${endpoint}/webhook`
);
export const environmentName = pulumiProv.name;
export const webhookName = webhook.displayName;
