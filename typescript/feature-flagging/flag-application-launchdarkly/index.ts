import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as launchdarkly from "@pulumi/launchdarkly";

const config = new pulumi.Config();

const provider = new launchdarkly.Provider("ld-prov", {
  accessToken: config.require("ldAccessToken"),
});

const flag = new launchdarkly.FeatureFlag(
  "example-flag",
  { key: "exampleFlag", projectKey: "default", variationType: "boolean" },
  { provider }
);

const flagEnvironment = new launchdarkly.FeatureFlagEnvironment(
  "example-flag-test-env",
  {
    flagId: flag.id,
    envKey: "test",
    on: true,
    rules: [
      {
        clauses: [
          {
            attribute: "name",
            op: "in",
            values: ["alice"],
            negate: false,
          },
        ],
        variation: 0, // true for boolean flags
      },
    ],
    fallthrough: {
      variation: 1, // false for everyone else
    },
    offVariation: 1,
  },
  { provider }
);

// IAM role for Lambda
const lambdaRole = new aws.iam.Role("lambda-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
        Effect: "Allow",
      },
    ],
  }),
});

// Attach basic Lambda execution policy
new aws.iam.RolePolicyAttachment("lambda-basic-execution", {
  role: lambdaRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

// Lambda function
const lambda = new aws.lambda.Function("flag-checker", {
  runtime: aws.lambda.Runtime.NodeJS20dX,
  handler: "lambda.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    "lambda.js": new pulumi.asset.FileAsset("./lambda/lambda.js"),
    "node_modules": new pulumi.asset.FileArchive("./lambda/node_modules"),
  }),
  environment: {
    variables: {
      LAUNCHDARKLY_SDK_KEY: config.requireSecret("ldSdkKey"),
    },
  },
});

// Create a Function URL for easy access
const functionUrl = new aws.lambda.FunctionUrl("flag-checker-url", {
  functionName: lambda.name,
  authorizationType: "NONE",
});

export const lambdaUrl = functionUrl.functionUrl;
