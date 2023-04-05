import { Config, getStack, getProject, getOrganization, StackReference } from "@pulumi/pulumi";

const config = new Config();

// Config values
export const nameBase = config.get("nameBase") || `ecs-app-${getStack()}`;
const baseInfraProject = config.require("baseInfraProject");

// Stack reference and stack outputs
const baseStackRef = new StackReference(`${getOrganization()}/${baseInfraProject}/${getStack()}`);
export const baseVpcId = baseStackRef.getOutput("vpcId")
export const dbHost = baseStackRef.getOutput("dbHost")
export const dbName = baseStackRef.getOutput("dbName")
export const dbUser = baseStackRef.getOutput("dbUser")
export const dbPassword = baseStackRef.getOutput("dbPassword")
export const clusterArn = baseStackRef.getOutput("ecsClusterArn")
