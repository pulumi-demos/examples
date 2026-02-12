import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface RdsClusterArgs {
  vpcId: pulumi.Input<string>;
  vpcCidrBlock: pulumi.Input<string>;
  subnetIds: pulumi.Input<string>[];
  databaseName: string;
  masterUsername: string;
  masterPassword: pulumi.Input<string>;
  iamDatabaseUser: string;
  instanceClass?: string;
  engineVersion?: string;
}

export class RdsCluster extends pulumi.ComponentResource {
  public readonly cluster: aws.rds.Cluster;
  public readonly instance: aws.rds.ClusterInstance;
  public readonly securityGroup: aws.ec2.SecurityGroup;
  private readonly iamDatabaseUser: string;

  constructor(
    name: string,
    args: RdsClusterArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:database:RdsCluster", name, {}, opts);

    this.iamDatabaseUser = args.iamDatabaseUser;
    const instanceClass = args.instanceClass || "db.t4g.medium";
    const engineVersion = args.engineVersion || "17.4";
    const config = new pulumi.Config();

    // Create DB subnet group (using public subnets for demo purposes)
    const subnetGroup = new aws.rds.SubnetGroup(
      `${name}-subnet-group`,
      {
        subnetIds: args.subnetIds,
        tags: { Name: `${name}-subnet-group` },
      },
      { parent: this }
    );

    // Create security group
    this.securityGroup = new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
        vpcId: args.vpcId,
        description: "Allow PostgreSQL access from VPC and authorized IPs",
        ingress: [
          {
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            cidrBlocks: [args.vpcCidrBlock],
            description: "Access from VPC",
          },
          {
            protocol: "tcp",
            fromPort: 5432,
            toPort: 5432,
            cidrBlocks: [`${config.require("myPublicIP")}/32`],
            description: "Access from authorized IP",
          },
        ],
        egress: [
          {
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
            cidrBlocks: ["0.0.0.0/0"],
          },
        ],
        tags: { Name: `${name}-sg` },
      },
      { parent: this }
    );

    // Create Aurora PostgreSQL cluster
    this.cluster = new aws.rds.Cluster(
      `${name}-cluster`,
      {
        engine: "aurora-postgresql",
        engineVersion: engineVersion,
        databaseName: args.databaseName,
        masterUsername: args.masterUsername,
        masterPassword: args.masterPassword,
        dbSubnetGroupName: subnetGroup.name,
        vpcSecurityGroupIds: [this.securityGroup.id],
        skipFinalSnapshot: true,
        iamDatabaseAuthenticationEnabled: true,
        tags: { Name: `${name}-cluster` },
      },
      { parent: this }
    );

    // Create cluster instance
    this.instance = new aws.rds.ClusterInstance(
      `${name}-instance`,
      {
        clusterIdentifier: this.cluster.id,
        instanceClass: instanceClass,
        engine: "aurora-postgresql",
        engineVersion: engineVersion,
        publiclyAccessible: true,
        tags: { Name: `${name}-instance` },
      },
      { parent: this }
    );

    this.registerOutputs({
      clusterEndpoint: this.cluster.endpoint,
      clusterReaderEndpoint: this.cluster.readerEndpoint,
      clusterResourceId: this.cluster.clusterResourceId,
    });
  }

  public createIamRole(
    oidcProvider: aws.iam.OpenIdConnectProvider,
    namespace: string,
    serviceAccountName: string,
    opts?: pulumi.ComponentResourceOptions
  ): aws.iam.Role {
    const roleName = `${this.getResourceName()}-iam-role`;

    // Get current AWS account ID and region
    const currentCaller = aws.getCallerIdentity();
    const currentRegion = aws.getRegionOutput();

    // Create IAM role for service account
    const iamAccessRole = new aws.iam.Role(
      roleName,
      {
        assumeRolePolicy: pulumi
          .all([oidcProvider.arn, oidcProvider.url])
          .apply(([arn, url]) =>
            JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: { Federated: arn },
                  Action: "sts:AssumeRoleWithWebIdentity",
                  Condition: {
                    StringEquals: {
                      [`${url}:sub`]: `system:serviceaccount:${namespace}:${serviceAccountName}`,
                    },
                  },
                },
              ],
            })
          ),
        tags: { Name: roleName },
      },
      { parent: this, ...opts }
    );

    // Create IAM policy for RDS IAM authentication
    // Per AWS docs: arn:aws:rds-db:region:account-id:dbuser:DbClusterResourceId/db-user-name
    const policy = new aws.iam.Policy(
      `${roleName}-policy`,
      {
        policy: pulumi
          .all([
            this.cluster.clusterResourceId,
            currentCaller.then((c) => c.accountId),
            currentRegion.region,
          ])
          .apply(([resourceId, accountId, region]) =>
            JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Action: ["rds-db:connect"],
                  Resource: `arn:aws:rds-db:${region}:${accountId}:dbuser:${resourceId}/${this.getIamDatabaseUser()}`,
                },
              ],
            })
          ),
      },
      { parent: this, ...opts }
    );

    // Attach policy to role
    new aws.iam.RolePolicyAttachment(
      `${roleName}-attachment`,
      {
        role: iamAccessRole.name,
        policyArn: policy.arn,
      },
      { parent: this, ...opts }
    );

    return iamAccessRole;
  }

  private getResourceName(): string {
    return pulumi.getStack() + "-" + this.constructor.name;
  }

  private getIamDatabaseUser(): string {
    return this.iamDatabaseUser;
  }
}
