import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { Namespace, Service } from "./components";

// Create IAM role for EKS cluster
const eksRole = new aws.iam.Role("eksRole", {
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
});

// Attach required policies to the EKS role
const eksClusterPolicyAttachment = new aws.iam.RolePolicyAttachment(
  "eksClusterPolicyAttachment",
  {
    policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    role: eksRole.name,
  }
);

// Create VPC for EKS cluster
const vpc = new aws.ec2.Vpc("eksVpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: "eks-vpc",
  },
});

// Create internet gateway
const igw = new aws.ec2.InternetGateway("eksIgw", {
  vpcId: vpc.id,
  tags: {
    Name: "eks-igw",
  },
});

// Create subnets
const subnet1 = new aws.ec2.Subnet("eksSubnet1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "us-east-1a",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "eks-subnet-1",
  },
});

const subnet2 = new aws.ec2.Subnet("eksSubnet2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.2.0/24",
  availabilityZone: "us-east-1b",
  mapPublicIpOnLaunch: true,
  tags: {
    Name: "eks-subnet-2",
  },
});

// Create route table
const routeTable = new aws.ec2.RouteTable("eksRouteTable", {
  vpcId: vpc.id,
  tags: {
    Name: "eks-route-table",
  },
});

// Create route to internet gateway
const route = new aws.ec2.Route("eksRoute", {
  routeTableId: routeTable.id,
  destinationCidrBlock: "0.0.0.0/0",
  gatewayId: igw.id,
});

// Associate route table with subnets
const routeTableAssociation1 = new aws.ec2.RouteTableAssociation(
  "eksRouteTableAssociation1",
  {
    subnetId: subnet1.id,
    routeTableId: routeTable.id,
  }
);

const routeTableAssociation2 = new aws.ec2.RouteTableAssociation(
  "eksRouteTableAssociation2",
  {
    subnetId: subnet2.id,
    routeTableId: routeTable.id,
  }
);

// Create an EKS cluster
const cluster = new aws.eks.Cluster(
  "microcomponent-cluster",
  {
    roleArn: eksRole.arn,
    vpcConfig: {
      subnetIds: [subnet1.id, subnet2.id],
    },
  },
  { dependsOn: [eksClusterPolicyAttachment] }
);

// Export the cluster's kubeconfig
export const kubeconfig = pulumi
  .all([cluster.endpoint, cluster.certificateAuthority, cluster.name])
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
const k8sProvider = new k8s.Provider("k8sProvider", {
  kubeconfig: kubeconfig,
});

// Create a Kubernetes namespace with labels
const namespace = new Namespace(
  "microcomponent-namespace",
  {
    labels: {
      environment: "dev",
      team: "backend",
    },
  },
  { provider: k8sProvider }
);

const ns = namespace.namespace;

// Create a Kubernetes service with labels
const service = new Service(
  "microcomponent-service",
  {
    labels: {
      app: "microcomponent-app",
      tier: "frontend",
    },
    ns: namespace.namespace,
    ports: [{ port: 80, targetPort: 80 }],
    type: "LoadBalancer",
  },
  { provider: k8sProvider }
);

// Export the service's IP address
export const serviceIp = service.service.status.loadBalancer.ingress[0].ip;
