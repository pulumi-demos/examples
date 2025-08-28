import * as pulumi from "@pulumi/pulumi";
import { SecretManagedRDSArgs } from "./type";
import { RotatorLambda } from "./rotator-lambda";
import { EnvironmentsForRotation } from "./environments";
import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";

export class SecretManagedRDS extends pulumi.ComponentResource {
  rdsDatabase: aws.rds.Cluster;
  rotator: RotatorLambda | undefined;
  envs: EnvironmentsForRotation | undefined;

  constructor(
    name: string,
    args: SecretManagedRDSArgs,
    opts: pulumi.ComponentResourceOptions
  ) {
    super("pkg:index:SecretManagedRDS", name, args, opts);

    if (
      !args.masterCredentialsConfiguration.masterPassword &&
      !args.masterCredentialsConfiguration.rotationSchedule
    ) {
      args.masterCredentialsConfiguration.masterPassword =
        new random.RandomPassword("dbPassword", {
          length: 32,
          special: false,
        }).result;
    }

    this.rdsDatabase = new aws.rds.Cluster(args.basename, {
      masterUsername: args.masterCredentialsConfiguration.masterUsername,
      masterPassword: args.masterCredentialsConfiguration.masterPassword,
      manageMasterUserPassword:
        args.masterCredentialsConfiguration.rotationSchedule !== undefined
          ? true
          : undefined,
      databaseName: args.basename,
      clusterIdentifier: args.basename,
      ...args.clusterArgs,
    });

    args.instances.forEach((instance, index) => {
      new aws.rds.ClusterInstance(`${args.basename}-${index}`, {
        clusterIdentifier: this.rdsDatabase.clusterIdentifier,
        ...instance,
      });
    });

    let secretArn: pulumi.Input<string> | undefined;
    if (args.masterCredentialsConfiguration.rotationSchedule) {
      const dbSecret = new aws.secretsmanager.SecretRotation(
        `${args.basename}-dbsecretrotation`,
        {
          secretId: this.rdsDatabase.masterUserSecrets[0].secretArn,
          rotationRules: {
            scheduleExpression:
              args.masterCredentialsConfiguration.rotationSchedule,
          },
        }
      );

      secretArn = this.rdsDatabase.masterUserSecrets[0].secretArn;
    }

    if (args.rotateUsers) {
      if (!args.publiclyAccessible) {
        this.rotator = new RotatorLambda(
          `${args.basename}-rotator`,
          {
            database: this.rdsDatabase,
            environmentName: args.environmentName,
            rotateUsers: args.rotateUsers,
            secretArn,
          },
          {}
        );
      }

      this.envs = new EnvironmentsForRotation(
        `${args.basename}-environments`,
        {
          database: this.rdsDatabase,
          secretArn,
          environmentName: args.environmentName,
          rotateUsers: args.rotateUsers,
          privateDBArgs: args.publiclyAccessible
            ? undefined
            : this.rotator
            ? {
                assumedRoleArn: this.rotator.assumedRoleArn,
                lambdaArn: this.rotator.lambda.arn,
                publiclyAccessible: args.publiclyAccessible,
              }
            : undefined,
        },
        {}
      );
    }

    // Registering Component Outputs
    this.registerOutputs({
      dbOutputs: this.rdsDatabase,
      rotator: this.rotator,
      environments: this.envs,
    });
  }
}
