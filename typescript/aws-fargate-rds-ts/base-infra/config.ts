import { Config, getProject, getStack } from "@pulumi/pulumi";
import { RandomPassword } from "@pulumi/random";

const config = new Config();

// name base for naming conventions
export const nameBase = config.get("nameBase") || `ecs-base-${getStack()}`;

// Get db info
export const dbName = config.get("dbName") || "backend";
export const dbUser = config.get("dbUser") || "admin";
// Get secretified password from config or create one using the "random" package
export let dbPassword = config.getSecret("dbPassword");
if (!dbPassword) {
  dbPassword = new RandomPassword("dbPassword", {
    length: 16,
    special: true,
    overrideSpecial: "_%",
  }).result;
}

// stack tags used to group stacks in the service.
export const stackTagName = config.get("stackTagName") ?? "Application";
export const stackTagValue = config.get("stackTagValue") ?? "Guestbook";

