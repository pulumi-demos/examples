import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

// Create a VPC
const vpc = new aws.ec2.Vpc("myVpc", {
  cidrBlock: "10.0.0.0/16",
});

// Create an Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("myInternetGateway", {
  vpcId: vpc.id,
});

// Create a Public Subnet
const publicSubnet = new aws.ec2.Subnet("myPublicSubnet", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  mapPublicIpOnLaunch: true,
});

// Create a Route Table
const routeTable = new aws.ec2.RouteTable("myRouteTable", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
});

// Associate the Route Table with the Public Subnet
new aws.ec2.RouteTableAssociation("myRouteTableAssociation", {
  subnetId: publicSubnet.id,
  routeTableId: routeTable.id,
});

// Security Group allowing HTTP and SSH
const securityGroup = new aws.ec2.SecurityGroup("mySecurityGroup", {
  vpcId: vpc.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: 80,
      toPort: 80,
      cidrBlocks: ["0.0.0.0/0"], // Replace with your actual IP range for HTTP access
    },
    {
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrBlocks: ["0.0.0.0/0"], // Replace with your actual IP range for SSH access
    },
  ],
  egress: [
    { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
  ],
});

// Create an EC2 instance
const server = new aws.ec2.Instance("myInstance", {
  instanceType: "t2.micro",
  ami: "ami-0c02fb55956c7d316", // Amazon Linux 2 AMI (us-east-1) - update for your region
  subnetId: publicSubnet.id,
  securityGroups: [securityGroup.name],
  userData: `#!/bin/bash
    echo "Hello, World!" > index.html
    nohup python -m SimpleHTTPServer 80 &`,
});

// Export the public IP of the instance
export const publicIp = server.publicIp;
export const publicDns = server.publicDns;
