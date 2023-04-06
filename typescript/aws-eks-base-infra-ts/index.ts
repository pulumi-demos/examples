import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as k8s from "@pulumi/kubernetes";

// Component Resources
import { Db } from "../components/aws_rds";

// Local Modules 
// Config data
import { dbName, dbPassword, dbUser, maxCount, minCount, nameBase, nodeCount, nodeMachineType, stackTagName, stackTagValue } from "./config";
// IAM resources
import { eksRole, ec2Role } from "./iam";
// Utils
import { genEksKubeconfig } from "./utils";

// Create a VPC for our cluster.
// Uses Pulumi-provided AWSx package to build VPC, Subnets, Gateways, etc.
const vpc = new awsx.ec2.Vpc(`${nameBase}-vpc`, { numberOfAvailabilityZones: 2 });

// Create the EKS cluster and related resources. 
const eksSgName = `${nameBase}-eks-sg`
const eksSecurityGroup = new aws.ec2.SecurityGroup(eksSgName, {
  vpcId: vpc.vpcId,
  description: "Allow all HTTP(s) traffic.",
  tags: { "Name": eksSgName },
  ingress: [
    {
      cidrBlocks: ["0.0.0.0/0"],
      fromPort: 443,
      toPort: 443,
      protocol: "tcp",
      description: "Allow HTTPS"
    },
    {
      cidrBlocks: ["0.0.0.0/0"],
      fromPort: 80,
      toPort: 80,
      protocol: "tcp",
      description: "Allow HTTP"
    }
  ],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"]
    }
  ]
})

const eksCluster = new aws.eks.Cluster(`${nameBase}-cluster`, {
  roleArn: eksRole.arn,
  vpcConfig: {
    publicAccessCidrs: ['0.0.0.0/0'],
    securityGroupIds: [eksSecurityGroup.id],
    subnetIds: vpc.publicSubnetIds
  }
})

const nodeGroupName = `${nameBase}-nodegroup`
const eksNodeGroup = new aws.eks.NodeGroup(nodeGroupName, {
  clusterName: eksCluster.name,
  nodeGroupName: nodeGroupName,
  nodeRoleArn: ec2Role.arn,
  subnetIds: vpc.publicSubnetIds,
  scalingConfig: {
    desiredSize: nodeCount,
    minSize: minCount,
    maxSize: maxCount
  },
  tags: {
    "Name": nodeGroupName,
    "ClusterName": eksCluster.name
  }
})

// Export the cluster's kubeconfig.
export const kubeconfig = pulumi.secret(genEksKubeconfig(eksCluster))

// Create a Database
const db = new Db(`${nameBase}-db`, {
  dbName: dbName,
  dbUser: dbUser,
  dbPassword: dbPassword,
  subnetIds: vpc.privateSubnetIds
});

// Add Pulumi service stack tag
const stackTag =  new pulumiservice.StackTag("stackTag", {
  organization: pulumi.getOrganization(),
  project: pulumi.getProject(),
  stack: pulumi.getStack(),
  name: stackTagName,
  value: pulumi.interpolate`${stackTagValue}-${pulumi.getStack()}`
})

