import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";

export interface EKSResourcesArgs {
  clusterName: string;
  environment?: string;
  team?: string;
  appName?: string;
  appImage?: string;
  appReplicas?: number;
  region?: string;
}

export class EKSResources extends pulumi.ComponentResource {
  public readonly kubeconfig: pulumi.Output<string>;
  public readonly serviceIp: pulumi.Output<string>;
  public readonly cluster: aws.eks.Cluster;

  constructor(
    name: string,
    args: EKSResourcesArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:eks:EKSResources", name, {}, opts);

    const environment = args.environment || "dev";
    const team = args.team || "platform";
    const appName = args.appName || "nginx-app";
    const appImage = args.appImage || "nginx";
    const appReplicas = args.appReplicas || 2;
    const region = args.region || "us-east-1";

    // Create IAM role for EKS cluster
    const eksRole = new aws.iam.Role(
      `${name}-eksRole`,
      {
        assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Effect: "Allow",
              Principal: {
                Service: "eks.amazonaws.com",
              },
            },
          ],
        }),
      },
      { parent: this }
    );

    // Attach required policies to the EKS role
    const eksClusterPolicyAttachment = new aws.iam.RolePolicyAttachment(
      `${name}-eksClusterPolicyAttachment`,
      {
        policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
        role: eksRole.name,
      },
      { parent: this }
    );

    // Create VPC for EKS cluster
    const vpc = new aws.ec2.Vpc(
      `${name}-vpc`,
      {
        cidrBlock: "10.0.0.0/16",
        enableDnsHostnames: true,
        enableDnsSupport: true,
        tags: {
          Name: `${args.clusterName}-vpc`,
          Environment: environment,
          Team: team,
        },
      },
      { parent: this }
    );

    // Create internet gateway
    const igw = new aws.ec2.InternetGateway(
      `${name}-igw`,
      {
        vpcId: vpc.id,
        tags: {
          Name: `${args.clusterName}-igw`,
          Environment: environment,
          Team: team,
        },
      },
      { parent: this }
    );

    // Create subnets in different AZs
    const subnet1 = new aws.ec2.Subnet(
      `${name}-subnet1`,
      {
        vpcId: vpc.id,
        cidrBlock: "10.0.1.0/24",
        availabilityZone: `${region}a`,
        mapPublicIpOnLaunch: true,
        tags: {
          Name: `${args.clusterName}-subnet-1`,
          Environment: environment,
          Team: team,
        },
      },
      { parent: this }
    );

    const subnet2 = new aws.ec2.Subnet(
      `${name}-subnet2`,
      {
        vpcId: vpc.id,
        cidrBlock: "10.0.2.0/24",
        availabilityZone: `${region}b`,
        mapPublicIpOnLaunch: true,
        tags: {
          Name: `${args.clusterName}-subnet-2`,
          Environment: environment,
          Team: team,
        },
      },
      { parent: this }
    );

    // Create route table
    const routeTable = new aws.ec2.RouteTable(
      `${name}-routeTable`,
      {
        vpcId: vpc.id,
        tags: {
          Name: `${args.clusterName}-route-table`,
          Environment: environment,
          Team: team,
        },
      },
      { parent: this }
    );

    // Create route to internet gateway
    const route = new aws.ec2.Route(
      `${name}-route`,
      {
        routeTableId: routeTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: igw.id,
      },
      { parent: this }
    );

    // Associate route table with subnets
    const routeTableAssociation1 = new aws.ec2.RouteTableAssociation(
      `${name}-routeTableAssociation1`,
      {
        subnetId: subnet1.id,
        routeTableId: routeTable.id,
      },
      { parent: this }
    );

    const routeTableAssociation2 = new aws.ec2.RouteTableAssociation(
      `${name}-routeTableAssociation2`,
      {
        subnetId: subnet2.id,
        routeTableId: routeTable.id,
      },
      { parent: this }
    );

    // Create EKS cluster
    this.cluster = new aws.eks.Cluster(
      `${name}-cluster`,
      {
        name: args.clusterName,
        roleArn: eksRole.arn,
        vpcConfig: {
          subnetIds: [subnet1.id, subnet2.id],
        },
        tags: {
          Environment: environment,
          Team: team,
        },
      },
      {
        parent: this,
        dependsOn: [eksClusterPolicyAttachment],
      }
    );

    // Export the cluster's kubeconfig
    this.kubeconfig = pulumi
      .all([
        this.cluster.endpoint,
        this.cluster.certificateAuthority,
        this.cluster.name,
      ])
      .apply(([endpoint, ca, name]) => {
        return JSON.stringify({
          apiVersion: "v1",
          clusters: [
            {
              cluster: {
                server: endpoint,
                "certificate-authority-data": ca.data,
              },
              name: "kubernetes",
            },
          ],
          contexts: [
            {
              context: {
                cluster: "kubernetes",
                user: "aws",
              },
              name: "aws",
            },
          ],
          "current-context": "aws",
          kind: "Config",
          users: [
            {
              name: "aws",
              user: {
                exec: {
                  apiVersion: "client.authentication.k8s.io/v1beta1",
                  command: "aws",
                  args: ["eks", "get-token", "--cluster-name", name],
                },
              },
            },
          ],
        });
      });

    // Create a Kubernetes provider instance using the cluster
    const k8sProvider = new k8s.Provider(
      `${name}-k8sProvider`,
      {
        kubeconfig: this.kubeconfig,
      },
      { parent: this }
    );

    // Create a Kubernetes namespace with labels
    const ns = new k8s.core.v1.Namespace(
      `${name}-namespace`,
      {
        metadata: {
          name: args.clusterName,
          labels: {
            environment,
            team,
          },
        },
      },
      { parent: this, provider: k8sProvider }
    );

    const appLabels = {
      app: appName,
      tier: "frontend",
      environment,
      team,
    };

    // Create a Kubernetes service with labels
    const service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          namespace: ns.metadata.name,
          labels: {
            app: appName,
            tier: "frontend",
          },
        },
        spec: {
          type: "LoadBalancer",
          selector: appLabels,
          ports: [{ port: 80, targetPort: 80 }],
        },
      },
      { parent: this, provider: k8sProvider }
    );

    // Export the service's IP address
    this.serviceIp = service.status.loadBalancer.ingress[0].ip;

    this.registerOutputs({
      kubeconfig: this.kubeconfig,
      serviceIp: this.serviceIp,
      cluster: this.cluster,
    });
  }
}
