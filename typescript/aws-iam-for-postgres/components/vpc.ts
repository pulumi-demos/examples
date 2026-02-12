import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface VpcArgs {
  cidrBlock: string;
  availabilityZones: pulumi.Input<string[]>;
}

export class Vpc extends pulumi.ComponentResource {
  public readonly vpc: aws.ec2.Vpc;
  public readonly publicSubnets: aws.ec2.Subnet[];
  public readonly privateSubnets: aws.ec2.Subnet[];
  public readonly internetGateway: aws.ec2.InternetGateway;
  public readonly natGateways: aws.ec2.NatGateway[];

  constructor(name: string, args: VpcArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:network:Vpc", name, {}, opts);

    // Create VPC
    this.vpc = new aws.ec2.Vpc(`${name}-vpc`, {
      cidrBlock: args.cidrBlock,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: { Name: `${name}-vpc` },
    }, { parent: this });

    // Create Internet Gateway
    this.internetGateway = new aws.ec2.InternetGateway(`${name}-igw`, {
      vpcId: this.vpc.id,
      tags: { Name: `${name}-igw` },
    }, { parent: this });

    // Helper function to calculate subnet CIDR blocks
    const calculateSubnetCidr = (vpcCidr: string, subnetIndex: number): string => {
      // Extract the base IP and prefix from VPC CIDR (e.g., "10.0.0.0/16")
      const [baseIp, prefix] = vpcCidr.split('/');
      const prefixNum = parseInt(prefix);
      const baseOctets = baseIp.split('.').map(Number);

      // For a /16 VPC, create /24 subnets by incrementing the third octet
      // For other VPC sizes, adjust accordingly
      const subnetPrefix = Math.min(prefixNum + 8, 24); // Create /24 subnets from /16 VPC
      const thirdOctet = baseOctets[2] + subnetIndex;

      return `${baseOctets[0]}.${baseOctets[1]}.${thirdOctet}.0/${subnetPrefix}`;
    };

    // Convert availabilityZones to an output for proper handling
    const azs = pulumi.output(args.availabilityZones);

    // Create public subnets (using indices 1-2 for 2 AZs)
    this.publicSubnets = [0, 1].map((i) => {
      return new aws.ec2.Subnet(`${name}-public-subnet-${i + 1}`, {
        vpcId: this.vpc.id,
        cidrBlock: pulumi.output(args.cidrBlock).apply(cidr =>
          calculateSubnetCidr(cidr, i + 1)
        ),
        availabilityZone: azs.apply(zones => zones[i]),
        mapPublicIpOnLaunch: true,
        tags: { Name: `${name}-public-subnet-${i + 1}` },
      }, { parent: this });
    });

    // Create private subnets (using indices 3-4 for 2 AZs)
    this.privateSubnets = [0, 1].map((i) => {
      return new aws.ec2.Subnet(`${name}-private-subnet-${i + 1}`, {
        vpcId: this.vpc.id,
        cidrBlock: pulumi.output(args.cidrBlock).apply(cidr =>
          calculateSubnetCidr(cidr, i + 3)
        ),
        availabilityZone: azs.apply(zones => zones[i]),
        tags: { Name: `${name}-private-subnet-${i + 1}` },
      }, { parent: this });
    });

    // Create route table for public subnets
    const publicRouteTable = new aws.ec2.RouteTable(`${name}-public-rt`, {
      vpcId: this.vpc.id,
      tags: { Name: `${name}-public-rt` },
    }, { parent: this });

    // Create route to Internet Gateway
    new aws.ec2.Route(`${name}-public-route`, {
      routeTableId: publicRouteTable.id,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: this.internetGateway.id,
    }, { parent: this });

    // Associate public subnets with route table
    this.publicSubnets.forEach((subnet, i) => {
      new aws.ec2.RouteTableAssociation(`${name}-public-rta-${i + 1}`, {
        subnetId: subnet.id,
        routeTableId: publicRouteTable.id,
      }, { parent: this });
    });

    // Create Elastic IPs for NAT Gateways (one per AZ)
    const eips = [0, 1].map((i) => {
      return new aws.ec2.Eip(`${name}-eip-${i + 1}`, {
        domain: "vpc",
        tags: { Name: `${name}-eip-${i + 1}` },
      }, { parent: this });
    });

    // Create NAT Gateways in public subnets
    this.natGateways = this.publicSubnets.map((subnet, i) => {
      return new aws.ec2.NatGateway(`${name}-nat-${i + 1}`, {
        subnetId: subnet.id,
        allocationId: eips[i].id,
        tags: { Name: `${name}-nat-${i + 1}` },
      }, { parent: this });
    });

    // Create route tables for private subnets (one per subnet for AZ isolation)
    this.privateSubnets.forEach((subnet, i) => {
      const privateRouteTable = new aws.ec2.RouteTable(`${name}-private-rt-${i + 1}`, {
        vpcId: this.vpc.id,
        tags: { Name: `${name}-private-rt-${i + 1}` },
      }, { parent: this });

      // Create route to NAT Gateway
      new aws.ec2.Route(`${name}-private-route-${i + 1}`, {
        routeTableId: privateRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        natGatewayId: this.natGateways[i].id,
      }, { parent: this });

      // Associate private subnet with its route table
      new aws.ec2.RouteTableAssociation(`${name}-private-rta-${i + 1}`, {
        subnetId: subnet.id,
        routeTableId: privateRouteTable.id,
      }, { parent: this });
    });

    this.registerOutputs({
      vpcId: this.vpc.id,
      publicSubnetIds: this.publicSubnets.map(s => s.id),
      privateSubnetIds: this.privateSubnets.map(s => s.id),
    });
  }
}
