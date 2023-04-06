/* 
 * Deploys:
 * - Network: VPC, Subnets, Security Groups
 * - DB Backend: MySQL RDS
 */

// Pulumi SDKs
import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import { ecs } from "@pulumi/aws";

// Components
import { Network } from "../../components/aws_network";
import { Db } from "../../components/aws_rds";

// Local Modules
import { nameBase, dbName, dbUser, dbPassword } from "./config";

// Create an AWS VPC and subnets, etc
const network = new Network(`${nameBase}-net`, {})

// Create a backend DB instance
const db = new Db(`${nameBase}-db`, {
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    subnetIds: network.subnetIds,
});

// Create an ECS cluster onto which applications can be deployed.
const ecsCluster = new ecs.Cluster(`${nameBase}-ecs`)

// Add stack tag for the Pulumi Service
const stackTag =  new pulumiservice.StackTag("stackTag", {
    organization: pulumi.getOrganization(),
    project: pulumi.getProject(),
    stack: pulumi.getStack(),
    name: "Application",
    value: pulumi.interpolate`ECS-Wordpress-${pulumi.getStack()}`
})

export const vpcId = network.vpcId;
export const ecsClusterArn = ecsCluster.arn;
export const dbHost = db.dbAddress;
export { dbName, dbUser, dbPassword}; 

