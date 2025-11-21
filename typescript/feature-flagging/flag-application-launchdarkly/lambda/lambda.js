const LaunchDarkly = require("@launchdarkly/node-server-sdk");

const client = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY || "");

exports.handler = async (event) => {
  await client.waitForInitialization();

  const userId = event.queryStringParameters?.userId || "anonymous";
  const userName = event.queryStringParameters?.name || userId;

  const user = {
    kind: "user",
    key: userId,
    name: userName,
  };

  const flagValue = await client.variation("exampleFlag", user, false);

  const message = flagValue
    ? `Hello ${userName}! The flag is ON for you. You're special!`
    : `Hello ${userName}! The flag is OFF for you. Standard greeting.`;

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: message,
  };
};
