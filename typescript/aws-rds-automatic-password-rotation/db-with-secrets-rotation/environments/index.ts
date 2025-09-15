import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as service from "@pulumi/pulumiservice";
import { dump } from "js-yaml";

export class EnvironmentsForRotation extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: {
      database: aws.rds.Cluster;
      environmentName: string;
      rotateUsers: {
        primaryUsername: string;
        backupUsername: string;
        rotationSchedule?: string;
      };
      secretArn?: pulumi.Input<string>;
      privateDBArgs?: {
        assumedRoleArn: pulumi.Input<string>;
        lambdaArn: pulumi.Input<string>;
        publiclyAccessible: boolean;
      };
    },
    opts: pulumi.ComponentResourceOptions
  ) {
    super("pkg:index:EnvironmentsForRotation", name, args, opts);
    const project = pulumi.getProject();
    // Load configs
    const awsConfig = new pulumi.Config("aws");
    const awsRegion = awsConfig.require("region");
    const organization = pulumi.getOrganization();
    const namePrefix = "PulumiEscSecretConnectorLambda-";
    const backendUrl = "https://api.pulumi.com";
    const database = args.database;

    const environment = {
      organization: organization,
      project: project,
      name: `${args.environmentName}ManagingCreds`,
    };

    const credsEnvironment = {
      organization: organization,
      project: project,
      name: args.environmentName,
    };
    const psp = new service.Provider(namePrefix + "PSP", {
      apiUrl: backendUrl,
    });

    const creds = pulumi
      .all([
        args.secretArn,
        database.masterUsername,
        database.masterPassword,
        args.privateDBArgs?.assumedRoleArn,
      ])
      .apply(([secret, masterUsername, masterPassword, assumedRoleArn]) => {
        const jsonImport = "${awsPassword.awsPassword}";
        const credsYaml: Record<string, any> = {
          values: {
            managingUser: secret
              ? { "fn::fromJSON": jsonImport }
              : {
                  username: masterUsername,
                  password: { "fn::secret": masterPassword },
                },
          },
        };

        if (args.privateDBArgs) {
          credsYaml.values.awsLogin = {
            "fn::open::aws-login": {
              oidc: {
                duration: "1h",
                roleArn: assumedRoleArn,
                sessionName: "pulumi-esc-secret-rotator",
              },
            },
          };
        }

        if (secret) {
          credsYaml.values.awsPassword = {
            "fn::open::aws-secrets": {
              region: awsRegion,
              login: "${awsLogin}",
              get: {
                awsPassword: {
                  secretId: secret,
                },
              },
            },
          };
        }

        const credsYaml2 = dump(credsYaml);
        const creds = new service.Environment(
          namePrefix + "RotatorEnvironmentManagingCreds",
          {
            organization: credsEnvironment.organization,
            project: credsEnvironment.project,
            name: credsEnvironment.name,
            yaml: credsYaml2,
          },
          {
            deleteBeforeReplace: true,
            provider: psp,
          }
        );
        return creds;
      });

    const rotatorType = database.port.apply((port) =>
      port === 5432 ? "postgres" : "mysql"
    );
    const managingUserImport =
      "${environments." +
      `${credsEnvironment.project}.${credsEnvironment.name}.managingUser}`;
    const awsLoginImport =
      "${environments." +
      `${credsEnvironment.project}.${credsEnvironment.name}.awsLogin}`;

    const yaml = args.privateDBArgs
      ? pulumi.interpolate`values:
         dbRotator:
           fn::rotate::${rotatorType}:
             inputs:
               database:
                 connector:
                   awsLambda:
                     login: ${awsLoginImport}
                     lambdaArn: ${args.privateDBArgs?.lambdaArn}
                 database: ${database.databaseName}
                 host: ${database.endpoint.apply((endpoint) => {
                   return endpoint.split(":")[0];
                 })}
                 port: ${database.port}
                 managingUser: ${managingUserImport}
               rotateUsers:
                 username1: ${args.rotateUsers.primaryUsername}
                 username2: ${args.rotateUsers.backupUsername}`
      : pulumi.interpolate`values:
                 dbRotator:
                   fn::rotate::${rotatorType}:
                     inputs:
                       database:
                         database: ${database.databaseName}
                         host: ${database.endpoint.apply((endpoint) => {
                           return endpoint.split(":")[0];
                         })}
                         port: ${database.port}
                         managingUser: ${managingUserImport}
                       rotateUsers:
                         username1: ${args.rotateUsers.primaryUsername}
                         username2: ${args.rotateUsers.backupUsername}`;

    const rotatorEnv = new service.Environment(
      namePrefix + "RotatorEnvironment",
      {
        organization: environment.organization,
        project: environment.project,
        name: environment.name,
        yaml: yaml,
      },
      {
        deleteBeforeReplace: true,
        dependsOn: creds,
        provider: psp,
      }
    );

    if (args.rotateUsers.rotationSchedule) {
      const rotation = new service.EnvironmentRotationSchedule(
        "rotatationschedule",
        {
          environment: rotatorEnv.name,
          organization,
          project,
          scheduleCron: args.rotateUsers.rotationSchedule,
        }
      );
    }

    this.registerOutputs({
      envs: [rotatorEnv, creds],
    });
  }
}
