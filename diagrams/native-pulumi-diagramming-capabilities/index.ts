import * as aws from "@pulumi/aws";

// Create VPC
const vpc = new aws.ec2.Vpc("main-vpc", {
  cidrBlock: "10.29.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: "main-vpc",
  },
});

// Create public subnets
const publicSubnet1 = new aws.ec2.Subnet("public-subnet-1", {
  vpcId: vpc.id,
  cidrBlock: "10.29.1.0/24",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "public-subnet-1",
    Type: "Public",
  },
});

const publicSubnet2 = new aws.ec2.Subnet("public-subnet-2", {
  vpcId: vpc.id,
  cidrBlock: "10.29.2.0/24",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "public-subnet-2",
    Type: "Public",
  },
});

// Create private subnets
const privateSubnet1 = new aws.ec2.Subnet("private-subnet-1", {
  vpcId: vpc.id,
  cidrBlock: "10.29.10.0/24",
  tags: {
    Name: "private-subnet-1",
    Type: "Private",
  },
});

// Create Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("main-igw", {
  vpcId: vpc.id,
  tags: {
    Name: "main-igw",
  },
});

// Create Elastic IP for NAT Gateway
const natEip = new aws.ec2.Eip("nat-eip", {
  domain: "vpc",
  tags: {
    Name: "nat-gateway-eip",
  },
});

// Create NAT Gateway
const natGateway = new aws.ec2.NatGateway("main-nat", {
  allocationId: natEip.id,
  subnetId: publicSubnet1.id,
  tags: {
    Name: "main-nat",
  },
});

// Create route tables
const publicRouteTable = new aws.ec2.RouteTable("public-rt", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
  tags: {
    Name: "public-route-table",
  },
});

const privateRouteTable = new aws.ec2.RouteTable("private-rt", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    },
  ],
  tags: {
    Name: "private-route-table",
  },
});

// Associate route tables with subnets
const publicRtAssociation1 = new aws.ec2.RouteTableAssociation(
  "public-rt-association-1",
  {
    subnetId: publicSubnet1.id,
    routeTableId: publicRouteTable.id,
  }
);

const publicRtAssociation2 = new aws.ec2.RouteTableAssociation(
  "public-rt-association-2",
  {
    subnetId: publicSubnet2.id,
    routeTableId: publicRouteTable.id,
  }
);

const privateRtAssociation1 = new aws.ec2.RouteTableAssociation(
  "private-rt-association-1",
  {
    subnetId: privateSubnet1.id,
    routeTableId: privateRouteTable.id,
  }
);

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Export the name of the bucket and VPC
export const bucketName = bucket.id;
export const vpcId = vpc.id;
