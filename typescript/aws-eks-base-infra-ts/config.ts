import { Config, getStack } from "@pulumi/pulumi";
import { RandomPassword } from "@pulumi/random";

const config = new Config();

// name base for naming conventions
export const nameBase = config.get("nameBase") || `eksbase-${getStack()}`;

// nodeCount is the number of cluster nodes to provision. Defaults to 3 if unspecified.
export const nodeCount = config.getNumber("nodeCount") || 3;
export const minCount = config.getNumber("minCount") || 1;
export const maxCount = config.getNumber("maxCount") || 5;

// nodeMachineType is the machine type to use for cluster nodes. Defaults to n1-standard-1 if unspecified.
export const nodeMachineType = config.get("nodeMachineType") || "t2.medium";

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

