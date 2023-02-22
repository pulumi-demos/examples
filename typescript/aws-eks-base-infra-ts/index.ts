import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

// Get stack config values
import { dbName, dbPassword, dbUser, maxCount, minCount, nameBase, nodeCount, nodeMachineType, stackTagName, stackTagValue } from "./config";

// DB Component resource
import { Db } from "./db";

// Create a VPC for our cluster.
const vpc = new awsx.ec2.Vpc(`${nameBase}-vpc`, { numberOfAvailabilityZones: 2 });

// Create the EKS cluster itself and a deployment of the Kubernetes dashboard.
const cluster = new eks.Cluster(`${nameBase}-cluster`, {
    vpcId: vpc.vpcId,
    subnetIds: vpc.publicSubnetIds,
    instanceType: nodeMachineType,
    desiredCapacity: nodeCount,
    minSize: minCount,
    maxSize: maxCount,
});
// Export the cluster's kubeconfig.
export const kubeconfig = pulumi.secret(cluster.kubeconfig);

const db = new Db(`${nameBase}-db`, {
  dbName: dbName,
  dbUser: dbUser,
  dbPassword: dbPassword,
  subnetIds: vpc.privateSubnetIds
});

const stackTag =  new pulumiservice.StackTag("stackTag", {
  organization: pulumi.getOrganization(),
  project: pulumi.getProject(),
  stack: pulumi.getStack(),
  name: stackTagName,
  value: pulumi.interpolate`${stackTagValue}-${pulumi.getStack()}`
})

