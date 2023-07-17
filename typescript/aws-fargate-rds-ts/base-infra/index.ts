/* 
 * Deploys:
 * - Network: VPC, Subnets, Security Groups
 * - DB Backend: MySQL RDS
 */

// Pulumi SDKs
import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import { ec2, ecs } from "@pulumi/aws";

// Components
import { Network } from "../../components/aws_network";
import { Db } from "../../components/aws_rds";

// Local Modules
import { nameBase, dbName, dbUser, dbPassword, stackTagName, stackTagValue } from "./config";

// Create an AWS VPC and subnets, etc
const network = new Network(`${nameBase}-net`, {})

// RDS acess security group.
const rdsSgName = `${nameBase}-rds-sg`
const rdsSecGroup = new ec2.SecurityGroup(rdsSgName, {
    vpcId: network.vpcId,
    description: "Allow DB client access.",
    tags: { "Name": rdsSgName },
    ingress: [{
        cidrBlocks: ["0.0.0.0/0"],
        fromPort: 3306,
        toPort: 3306,
        protocol: "tcp",
        description: "Allow RDS access."
    }],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"],
    }]
});

// Create a backend DB instance
const db = new Db(`${nameBase}-db`, {
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    subnetIds: network.subnetIds,
    securityGroupIds: [rdsSecGroup.id]
});

// Create an ECS cluster onto which applications can be deployed.
const ecsCluster = new ecs.Cluster(`${nameBase}-ecs`)

// Add stack tag for the Pulumi Service
const stackTag =  new pulumiservice.StackTag("stackTag", {
    organization: pulumi.getOrganization(),
    project: pulumi.getProject(),
    stack: pulumi.getStack(),
    name: stackTagName,
    value: stackTagValue
})

export const vpcId = network.vpcId;
export const ecsClusterArn = ecsCluster.arn;
export const dbHost = db.dbAddress;
export { dbName, dbUser, dbPassword}; 

