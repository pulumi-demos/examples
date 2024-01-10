using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using Pulumi;
using Pulumi.Aws;
using Pulumi.Aws.Ec2;
using Pulumi.Aws.Inputs;
using Pulumi.Awsx.Ec2;
using Pulumi.Awsx.Ec2.Inputs;
using Vpc = Pulumi.Awsx.Ec2.Vpc;

public class VpcBase : Stack
{
    [Output]
    public Output<string> VpcId { get; set; }

    [Output]
    public Output<string> CidrBlock {get; set;}

    [Output]
    public Output<ImmutableArray<string>> PublicSubnetIds { get; private set; }

    [Output]
    public Output<ImmutableArray<string>> PrivateSubnetIds { get; private set; }

    [Output]
    public Output<ImmutableArray<string>> InternalSubnetIds { get; private set; }

    public VpcBase()
    {
        var config = new Pulumi.Config();
        var projectName = Deployment.Instance.ProjectName;

        
        var awsProvider = new Provider("aws-provider", new ()
        {
            DefaultTags = new ProviderDefaultTagsArgs
            {
                Tags =
               {
                  { "Environment", "Development" },
                  { "Project", "ASGDemo" }
               }
            }
        });

        var cidrBlock = config.Get("CidrBlock") ?? "10.0.0.0/16";
        var numberOfAvailabilityZones = config.GetInt32("NumberOfAzs");
        var vpc = new Vpc(projectName, new()
        {
            CidrBlock = cidrBlock,
            NumberOfAvailabilityZones = numberOfAvailabilityZones,
            NatGateways = new NatGatewayConfigurationArgs()
            {
                Strategy = (config.GetBoolean("enableNAT") ?? false) ? NatGatewayStrategy.Single : NatGatewayStrategy.None,
            },
            SubnetStrategy = SubnetAllocationStrategy.Auto,
            EnableDnsHostnames = true,
            SubnetSpecs = new List<SubnetSpecArgs> () {
                new SubnetSpecArgs {
                Type = SubnetType.Private,
                },
                new SubnetSpecArgs {
                Type = SubnetType.Public,
                },
                new SubnetSpecArgs {
                Type = SubnetType.Isolated,
                }
            },

        }, new ComponentResourceOptions()
        {
            Provider = awsProvider
        });

        var region = awsProvider.Region;

        var gatewayServices = config.GetObject<IEnumerable<string>>("gatewayEndpointServices") ?? new string[]{};
        var gatewayEndpoints = gatewayServices.Select( ep => {
            return vpc.RouteTables.Apply(rt => {
                return new VpcEndpoint($"{projectName}-ep-{ep}", new VpcEndpointArgs
                {
                    VpcId = vpc.AwsVpc.Apply(vpc => vpc.Id),
                    ServiceName = Output.Format($"com.amazonaws.{region}.{ep}"),
                    VpcEndpointType = "Gateway",
                    RouteTableIds = rt.Select(x => x.Id).ToArray()
                });
            });
        }).ToList();      

        var interfaceServices = config.GetObject<IEnumerable<string>>("interfaceEndpointServices") ?? new string[]{};
        var interfaceEndpoints = interfaceServices.Select( ep => {
            return new VpcEndpoint($"{projectName}-ep-{ep}", new VpcEndpointArgs
            {
                VpcId = vpc.AwsVpc.Apply(vpc => vpc.Id),
                ServiceName = Output.Format($"com.amazonaws.{region}.{ep}"),
                VpcEndpointType = "Interface",
                SubnetIds = vpc.PrivateSubnetIds
            });
        }).ToList();      
 

        this.VpcId = vpc.AwsVpc.Apply(vpc => vpc.Id);
        this.CidrBlock = vpc.AwsVpc.Apply(vpc => vpc.CidrBlock);

        this.PublicSubnetIds = vpc.PublicSubnetIds;
        this.PrivateSubnetIds = vpc.PrivateSubnetIds;
        this.InternalSubnetIds = vpc.IsolatedSubnetIds;
    }
}