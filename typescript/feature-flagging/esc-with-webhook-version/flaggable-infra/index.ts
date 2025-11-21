import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";

// Load configuration
const config = new pulumi.Config();
const enableInternetAccess = config.getBoolean("enableInternetAccess") || false;

// Create VPC
const vpc = new aws.ec2.Vpc("myVpc", {
  cidrBlock: "10.45.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: "my-vpc",
  },
});

// Always create a private subnet
const privateSubnet = new aws.ec2.Subnet("privateSubnet", {
  vpcId: vpc.id,
  cidrBlock: "10.45.1.0/24",
  availabilityZone: "us-east-1a",
  tags: {
    Name: "private-subnet",
  },
});

// Conditionally create internet access resources
if (enableInternetAccess) {
  // Create Internet Gateway
  const igw = new aws.ec2.InternetGateway("internetGateway", {
    vpcId: vpc.id,
    tags: {
      Name: "my-igw",
    },
  });

  // Create public subnet
  const publicSubnet = new aws.ec2.Subnet("publicSubnet", {
    vpcId: vpc.id,
    cidrBlock: "10.45.2.0/24",
    availabilityZone: "us-east-1a",
    mapPublicIpOnLaunch: true,
    tags: {
      Name: "public-subnet",
    },
  });

  // Create route table for public subnet
  const publicRouteTable = new aws.ec2.RouteTable("publicRouteTable", {
    vpcId: vpc.id,
    tags: {
      Name: "public-rt",
    },
  });

  // Add route to Internet Gateway
  new aws.ec2.Route("publicRoute", {
    routeTableId: publicRouteTable.id,
    destinationCidrBlock: "0.0.0.0/0",
    gatewayId: igw.id,
  });

  // Associate route table with public subnet
  new aws.ec2.RouteTableAssociation("publicRouteTableAssociation", {
    subnetId: publicSubnet.id,
    routeTableId: publicRouteTable.id,
  });
}

//Add Deployment Settings for git managememt
const deploymentSettingsResource = new pulumiservice.DeploymentSettings(
  "deploymentSettingsResource",
  {
    organization: pulumi.getOrganization(),
    project: pulumi.getProject(),
    stack: pulumi.getStack(),
    github: {
      deployCommits: false,
      previewPullRequests: false,
      pullRequestTemplate: false,
      repository: config.require("repoUrl"),
    },
    cacheOptions: {
      enable: true,
    },
    sourceContext: {
      git: {
        branch: "main",
        repoDir: "./esc-with-webhook-version/flaggable-infra",
      },
    },
  }
);

export const vpcId = vpc.id;
export const privateSubnetId = privateSubnet.id;
