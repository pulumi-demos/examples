import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as tls from "@pulumi/tls";

export interface EksClusterArgs {
  vpcId: pulumi.Input<string>;
  publicSubnetIds: pulumi.Input<string>[];
  privateSubnetIds: pulumi.Input<string>[];
  nodeInstanceType?: string;
  desiredNodeCount?: number;
}

export class EksCluster extends pulumi.ComponentResource {
  public readonly cluster: aws.eks.Cluster;
  public readonly nodeGroup: aws.eks.NodeGroup;
  public readonly oidcProvider: aws.iam.OpenIdConnectProvider;
  public readonly kubeconfig: pulumi.Output<string>;

  constructor(name: string, args: EksClusterArgs, opts?: pulumi.ComponentResourceOptions) {
    super("custom:kubernetes:EksCluster", name, {}, opts);

    const nodeInstanceType = args.nodeInstanceType || "t3.small";
    const desiredNodeCount = args.desiredNodeCount || 1;

    // Create IAM role for EKS cluster
    const clusterRole = new aws.iam.Role(`${name}-cluster-role`, {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: { Service: "eks.amazonaws.com" },
          Action: "sts:AssumeRole",
        }],
      }),
    }, { parent: this });

    new aws.iam.RolePolicyAttachment(`${name}-cluster-policy`, {
      role: clusterRole.name,
      policyArn: "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    }, { parent: this });

    // Create EKS cluster
    this.cluster = new aws.eks.Cluster(`${name}-cluster`, {
      roleArn: clusterRole.arn,
      vpcConfig: {
        subnetIds: pulumi.all([args.publicSubnetIds, args.privateSubnetIds]).apply(
          ([pub, priv]) => [...pub, ...priv]
        ),
      },
    }, { parent: this });

    // Create IAM role for node group
    const nodeRole = new aws.iam.Role(`${name}-node-role`, {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
          Effect: "Allow",
          Principal: { Service: "ec2.amazonaws.com" },
          Action: "sts:AssumeRole",
        }],
      }),
    }, { parent: this });

    const nodePolicies = [
      "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
      "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
      "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    ];

    nodePolicies.forEach((policyArn, i) => {
      new aws.iam.RolePolicyAttachment(`${name}-node-policy-${i}`, {
        role: nodeRole.name,
        policyArn: policyArn,
      }, { parent: this });
    });

    // Create node group (nodeRoleArn creates implicit dependency on nodeRole)
    this.nodeGroup = new aws.eks.NodeGroup(`${name}-node-group`, {
      clusterName: this.cluster.name,
      nodeRoleArn: nodeRole.arn,
      subnetIds: args.privateSubnetIds,
      scalingConfig: {
        desiredSize: desiredNodeCount,
        minSize: 1,
        maxSize: desiredNodeCount + 1,
      },
      instanceTypes: [nodeInstanceType],
      diskSize: 20,
    }, { parent: this });

    // Get the TLS certificate thumbprint from the OIDC issuer
    const oidcThumbprint = this.cluster.identities[0].oidcs[0].issuer.apply(issuerUrl => {
      // Extract the hostname from the issuer URL
      const url = new URL(issuerUrl);
      return tls.getCertificateOutput({
        url: `${url.protocol}//${url.host}`,
      }).certificates[0].sha1Fingerprint;
    });

    // Create OIDC provider for IRSA
    this.oidcProvider = new aws.iam.OpenIdConnectProvider(`${name}-oidc-provider`, {
      clientIdLists: ["sts.amazonaws.com"],
      thumbprintLists: [oidcThumbprint],
      url: this.cluster.identities[0].oidcs[0].issuer,
    }, { parent: this });

    // Generate kubeconfig
    const currentRegion = aws.getRegionOutput();
    this.kubeconfig = pulumi.all([
      this.cluster.name,
      this.cluster.endpoint,
      this.cluster.certificateAuthority,
      currentRegion.region
    ]).apply(([clusterName, endpoint, certAuth, region]) => {
      return JSON.stringify({
        apiVersion: "v1",
        kind: "Config",
        clusters: [{
          cluster: {
            server: endpoint,
            "certificate-authority-data": certAuth.data,
          },
          name: "kubernetes",
        }],
        contexts: [{
          context: {
            cluster: "kubernetes",
            user: "aws",
          },
          name: "aws",
        }],
        "current-context": "aws",
        users: [{
          name: "aws",
          user: {
            exec: {
              apiVersion: "client.authentication.k8s.io/v1beta1",
              command: "aws",
              args: [
                "eks",
                "get-token",
                "--cluster-name",
                clusterName,
                "--region",
                region,
              ],
            },
          },
        }],
      });
    });

    this.registerOutputs({
      clusterName: this.cluster.name,
      clusterEndpoint: this.cluster.endpoint,
      oidcProviderArn: this.oidcProvider.arn,
    });
  }
}
