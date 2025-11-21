const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const secretsClient = new SecretsManagerClient({});
let cachedToken = null;

async function getPulumiToken() {
  // Use cached token if available
  if (cachedToken) {
    return cachedToken;
  }

  const secretArn = process.env.PULUMI_ACCESS_TOKEN_SECRET;
  if (!secretArn) {
    throw new Error("PULUMI_ACCESS_TOKEN_SECRET not set");
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await secretsClient.send(command);

  if (!response.SecretString) {
    throw new Error("Secret value is empty");
  }

  const token = response.SecretString;
  cachedToken = token;
  return token;
}

exports.handler = async (event) => {
  console.log("Received webhook event:", JSON.stringify(event, null, 2));

  try {
    // Parse the webhook payload
    const body = event.body ? JSON.parse(event.body) : {};
    const webhookEvent = body;

    // Get Pulumi token from Secrets Manager
    const pulumiToken = await getPulumiToken();

    const orgName = webhookEvent.organization.githubLogin;
    const envName = webhookEvent.environmentName;
    const projectName =
      webhookEvent.projectName || process.env.PROJECT_NAME || "featureflagging";

    console.log(
      `Processing ESC environment change: ${orgName}/${projectName}/${envName}`
    );

    // Find all stacks in the organization
    const stacks = await findStacksUsingEnvironment(
      pulumiToken,
      orgName,
      projectName,
      envName
    );

    console.log(`Found ${stacks.length} stacks using environment ${envName}`);

    // Trigger updates for each stack
    const updateResults = await Promise.allSettled(
      stacks.map((stack) =>
        triggerStackUpdate(
          pulumiToken,
          orgName,
          stack.projectName,
          stack.stackName
        )
      )
    );

    const successCount = updateResults.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const failureCount = updateResults.filter(
      (r) => r.status === "rejected"
    ).length;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ESC environment change for ${envName}`,
        stacksFound: stacks.length,
        updatesTriggered: successCount,
        updatesFailed: failureCount,
        stacks: stacks.map((s) => `${s.projectName}/${s.stackName}`),
      }),
    };
  } catch (error) {
    console.error("Error processing webhook:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error processing webhook",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

async function findStacksUsingEnvironment(
  token,
  orgName,
  projectName,
  envName
) {
  // Get all stacks in the organization
  const stacksResponse = await fetch(
    `https://api.pulumi.com/api/user/stacks?organization=${orgName}`,
    {
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!stacksResponse.ok) {
    throw new Error(`Failed to fetch stacks: ${stacksResponse.statusText}`);
  }

  const stacksData = await stacksResponse.json();
  const allStacks = stacksData.stacks || [];

  // Filter stacks that use this environment
  const stacksUsingEnv = [];

  for (const stack of allStacks) {
    try {
      // Get the most recent update to check which environments the stack uses
      const updatesResponse = await fetch(
        `https://api.pulumi.com/api/stacks/${orgName}/${stack.projectName}/${stack.stackName}/updates`,
        {
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (updatesResponse.ok) {
        const updatesData = await updatesResponse.json();
        const updates = updatesData.updates || [];

        if (updates.length > 0) {
          const latestUpdate = updates[0];
          const stackEnvironments =
            latestUpdate.environment?.["stack.environments"];

          if (stackEnvironments) {
            // Parse the environments JSON string
            const environments = JSON.parse(stackEnvironments);

            // Check if this stack uses the modified environment
            const usesEnv = environments.some((env) => {
              // Environment IDs can be in formats like:
              // - "projectName/envName"
              // - "orgName/projectName/envName"
              const envId = env.id || "";
              return (
                envId === envName ||
                envId === `${projectName}/${envName}` ||
                envId === `${orgName}/${projectName}/${envName}`
              );
            });

            if (usesEnv) {
              console.log(
                `Stack ${stack.projectName}/${stack.stackName} uses environment ${envName}`
              );
              stacksUsingEnv.push({
                projectName: stack.projectName,
                stackName: stack.stackName,
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(
        `Error checking stack ${stack.projectName}/${stack.stackName}:`,
        error
      );
    }
  }

  return stacksUsingEnv;
}

async function triggerStackUpdate(token, orgName, projectName, stackName) {
  console.log(
    `Triggering deployment for stack: ${orgName}/${projectName}/${stackName}`
  );

  const response = await fetch(
    `https://api.pulumi.com/api/stacks/${orgName}/${projectName}/${stackName}/deployments`,
    {
      method: "POST",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        operation: "update",
        inheritSettings: true,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to trigger deployment for ${projectName}/${stackName}: ${errorText}`
    );
  }

  const result = await response.json();
  console.log(`Deployment triggered for ${projectName}/${stackName}:`, result);
}
