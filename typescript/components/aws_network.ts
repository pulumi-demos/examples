import { ComponentResource, ComponentResourceOptions, interpolate, Output } from "@pulumi/pulumi";
import { ec2, getAvailabilityZonesOutput } from "@pulumi/aws";

// Interface for Network
export interface NetworkArgs {
  cidrBlock?: string;
  enableDnsHostnames?: boolean;
  enableDnsSupport?: boolean;
}

// Creates Network elements (e.g. VPC, etc)
export class Network extends ComponentResource {
  public readonly vpcId: Output<string>;
  public readonly subnetIds: Output<string>[];

  constructor(name: string, args: NetworkArgs, opts?: ComponentResourceOptions) {
    super("custom:resource:Network", name, args, opts);

    const vpcName = `${name}-vpc`;
    const vpc = new ec2.Vpc(vpcName, {
      cidrBlock: args.cidrBlock ?? "10.100.0.0/16",
      instanceTenancy: "default",
      enableDnsHostnames: args.enableDnsHostnames ?? true,
      enableDnsSupport: args.enableDnsSupport ?? true,
      tags: {
        "Name": vpcName
      },
    }, { parent: this })

    const igwName = `${name}-igw`
    const igw = new ec2.InternetGateway(igwName, {
      vpcId: vpc.id,
      tags: {
        "Name": igwName
      }
    }, { parent: this })

    const rtName = `${name}-rt`
    const routeTable =  new ec2.RouteTable(rtName, {
      vpcId: vpc.id,
      routes: [{
        cidrBlock: "0.0.0.0/0",
        gatewayId: igw.id
      }],
      tags: {
        "Name": rtName
      }
    }, { parent: this })

    // Build some subnets
    const allZones = getAvailabilityZonesOutput();
    // limiting to 2 zones for speed and to meet minimal requirements.
    const zoneNames = [allZones.names[0], allZones.names[1]]
    const snetIds: Output<string>[] = []
    const subnetNameBase = `${name}-subnet`
    for (var index in zoneNames) {
        const vpcSubnet = new ec2.Subnet(`${subnetNameBase}-${index}`, {
            vpcId: vpc.id,
            assignIpv6AddressOnCreation: false,
            mapPublicIpOnLaunch: true,
            cidrBlock: `10.100.${snetIds.length}.0/24`,
            availabilityZone: zoneNames[index],
            tags: {
                "Name": interpolate`${subnetNameBase}-${zoneNames[index]}`
            }
        }, { parent: this })

        const rtAssociation = new ec2.RouteTableAssociation(`vpc-route-table-assoc-${index}`, {
            routeTableId: routeTable.id,
            subnetId: vpcSubnet.id,
        }, { parent: this })
            
        snetIds.push(vpcSubnet.id)
    }

    

    this.vpcId = vpc.id;
    this.subnetIds = snetIds;
    this.registerOutputs({});
  }
}
