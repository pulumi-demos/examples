// Pulumi SDKs
import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";

// Local module
import { nameBase, baseVpcId, dbHost, dbName, dbUser, dbPassword, clusterArn } from "./config";

// Component resource
import { Frontend } from "./frontend";

// Create a frontend which consists of various resources like security groups, load balancers, ecs task
const frontend = new Frontend(`${nameBase}-fe`, {
  vpcId: baseVpcId,
  ecsClusterArn: clusterArn,
  dbHost: dbHost,
  dbName: dbName,
  dbUser: dbUser,
  dbPassword: dbPassword
})

// Add stack tag for the Pulumi Service
const stackTag =  new pulumiservice.StackTag("stackTag", {
  organization: pulumi.getOrganization(),
  project: pulumi.getProject(),
  stack: pulumi.getStack(),
  name: "Application",
  value: pulumi.interpolate`ECS-Wordpress-${pulumi.getStack()}`
})

