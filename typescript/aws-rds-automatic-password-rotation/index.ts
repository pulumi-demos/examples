// Example usage of the SecretManagedRDS module
import { SecretManagedRDS } from "./db-with-secrets-rotation";
import * as aws from "@pulumi/aws";

const PUBLICLY_ACCESSIBLE = false;

new SecretManagedRDS(
  "exampleManagedDB",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
      },
    ],
    basename: "examplerot",
    masterCredentialsConfiguration: {
      masterUsername: "admin",
      masterPassword: "example-password-123",
      //rotationSchedule: "cron(0 0 * * ? *)",
    },
    publiclyAccessible: PUBLICLY_ACCESSIBLE,
    environmentName: "example",
    rotateUsers: {
      primaryUsername: "app_user_1",
      backupUsername: "app_user_2",
      rotationSchedule: "0 0 * * *",
    },
  },
  {}
);
