import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export class RotatorLambda extends pulumi.ComponentResource {
  lambda: aws.lambda.Function;
  assumedRoleArn: pulumi.Input<string>;

  constructor(
    name: string,
    args: {
      database: aws.rds.Cluster;
      environmentName: string;
      rotateUsers: { primaryUsername: string; backupUsername: string };
      secretArn?: pulumi.Input<string>;
    },
    opts: pulumi.ComponentResourceOptions
  ) {
    super("pkg:index:RotatorLambda", name, args, opts);
    //Set up variables
    const ARCHIVE_BUCKET_PREFIX = "public-esc-rotator-lambdas-production";
    const ARCHIVE_KEY = "aws-lambda/latest.zip";
    const ARCHIVE_SIGNING_PROFILE_VERSION_ARN =
      "arn:aws:signer:us-west-2:388588623842:/signing-profiles/pulumi_esc_production_20250325212043887700000001/jva5X9nqMa";

    const organization = pulumi.getOrganization();

    // Load configs
    const awsConfig = new pulumi.Config("aws");
    const awsRegion = awsConfig.require("region");

    const backendUrl = "https://api.pulumi.com";
    const oidcUrl = new URL(`oidc`, backendUrl).toString();

    // Retrieve reference to current code artifact from trusted pulumi bucket
    const lambdaArchiveBucket = `${ARCHIVE_BUCKET_PREFIX}-${awsRegion}`;
    const codeArtifact = aws.s3.getObjectOutput({
      bucket: lambdaArchiveBucket,
      key: ARCHIVE_KEY,
    });

    // Introspect RDS to discover network settings
    const database = args.database;
    const subnetGroup = aws.rds.getSubnetGroupOutput({
      name: database.dbSubnetGroupName,
    });
    const databaseSecurityGroupId = database.vpcSecurityGroupIds[0];
    const databasePort = database.port;
    const vpcId = subnetGroup.vpcId;
    let validatedSubnetIds = subnetGroup.subnetIds.apply(async (ids) => {
      const subnetValidations = ids.map(id => 
        aws.ec2.getSubnet({ id }, { async: false })
          .then(() => id)
          .catch(() => {
            console.warn(`Invalid subnet found: ${id}`);
            return null;
          })
      );
      
      const results = await Promise.all(subnetValidations);
      return results.filter((id): id is string => id !== null);
    });

    // Create resources
    const namePrefix = "PulumiEscSecretConnectorLambda-";
    const codeSigningConfig = new aws.lambda.CodeSigningConfig(
      namePrefix + "CodeSigningConfig",
      {
        description:
          "Pulumi ESC rotation connector lambda signature - https://github.com/pulumi/esc-rotator-lambdas",
        allowedPublishers: {
          signingProfileVersionArns: [ARCHIVE_SIGNING_PROFILE_VERSION_ARN],
        },
        policies: {
          untrustedArtifactOnDeployment: "Enforce",
        },
      }
    );
    const lambdaExecRole = new aws.iam.Role(namePrefix + "ExecutionRole", {
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
          },
        ],
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
      ],
    });
    const lambdaSecurityGroup = new aws.ec2.SecurityGroup(
      namePrefix + "SecurityGroup",
      {
        vpcId: vpcId,
        description: "Security group for Pulumi ESC rotation lambda",
      }
    );
    const lambdaEgressRule = new aws.ec2.SecurityGroupRule(
      namePrefix + "ToDatabaseEgressRule",
      {
        description: "Allow connections to database",
        type: "egress",
        protocol: "tcp",
        fromPort: databasePort,
        toPort: databasePort,
        securityGroupId: lambdaSecurityGroup.id,
        sourceSecurityGroupId: databaseSecurityGroupId,
      }
    );
    const databaseIngressRule = new aws.ec2.SecurityGroupRule(
      namePrefix + "FromDatabaseIngressRule",
      {
        description: "Allow connections from rotation lambda",
        type: "ingress",
        protocol: "tcp",
        fromPort: databasePort,
        toPort: databasePort,
        sourceSecurityGroupId: lambdaSecurityGroup.id,
        securityGroupId: databaseSecurityGroupId,
      }
    );
    this.lambda = new aws.lambda.Function(namePrefix + "Function", {
      description:
        "The connector lambda proxies a secret rotation request from Pulumi ESC to a service within your VPC.",
      s3Bucket: codeArtifact.bucket,
      s3Key: codeArtifact.key,
      s3ObjectVersion: codeArtifact.versionId,
      codeSigningConfigArn: codeSigningConfig.arn,
      runtime: "provided.al2023",
      handler: "bootstrap",
      role: lambdaExecRole.arn,
      vpcConfig: {
        subnetIds: validatedSubnetIds,
        securityGroupIds: [lambdaSecurityGroup.id],
      },
    });
    let oidcProviderArn: pulumi.Input<String>;
    const oidcAudience = "aws:" + organization;
    const oidcUrlNoProtocol = oidcUrl.replace("https://", "");
    oidcProviderArn = pulumi.output(
      aws.iam.getOpenIdConnectProvider({ url: oidcUrl }, { async: false }).then(
        (res) => {
          if (!res.clientIdLists.includes(oidcAudience)) {
            throw Error(`Unable to create OIDC identity provider, because OIDC provider for ${oidcUrlNoProtocol} already exists for the AWS Account.
                    Please manually add "${oidcAudience}" to the list of audiences within the ${oidcUrlNoProtocol} identity provider`);
          }
          return res.arn;
        },
        (_) => {
          return new aws.iam.OpenIdConnectProvider(
            namePrefix + "OidcProvider",
            {
              url: oidcUrl,
              clientIdLists: [oidcAudience],
            },
            {
              retainOnDelete: true,
            }
          ).arn;
        }
      )
    );
    const assumedRole = new aws.iam.Role(namePrefix + "InvocationRole", {
      description: "Allow Pulumi ESC to invoke/manage the connector lambda",
      assumeRolePolicy: pulumi.jsonStringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRoleWithWebIdentity",
            Effect: "Allow",
            Principal: {
              Federated: oidcProviderArn,
            },
            Condition: {
              StringEquals: {
                [`${oidcUrlNoProtocol}:aud`]: oidcAudience,
              },
            },
          },
        ],
      }),
      inlinePolicies: [
        {
          policy: pulumi.jsonStringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "AllowPulumiToInvokeLambda",
                Effect: "Allow",
                Action: ["lambda:GetFunction", "lambda:InvokeFunction"],
                Resource: this.lambda.arn,
              },
              {
                Sid: "AllowPulumiToUpdateLambda",
                Effect: "Allow",
                Action: "lambda:UpdateFunctionCode",
                Resource: this.lambda.arn,
              },
              {
                Sid: "AllowPulumiToFetchUpdatedLambdaArchives",
                Effect: "Allow",
                Action: "s3:GetObject",
                Resource: `arn:aws:s3:::${lambdaArchiveBucket}/*`,
              },
              ...(args.secretArn
                ? [
                    {
                      Sid: "AllowPulumiToGetSecretIfApplicable",
                      Effect: "Allow",
                      Action: "secretsmanager:GetSecretValue",
                      Resource: args.secretArn,
                    },
                  ]
                : []),
            ],
          }),
        },
      ],
    });

    this.assumedRoleArn = assumedRole.arn;
    this.registerOutputs({
      lambdaArn: this.lambda.arn,
      assumedRoleArn: assumedRole.arn,
    });
  }
}
