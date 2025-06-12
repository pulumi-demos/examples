import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const pulumiConfig = new pulumi.Config();
const baseName = pulumiConfig.require("basename");
const dbVersion = pulumiConfig.require("DB_VERSION");
const dbUsername = pulumiConfig.require("DB_USERNAME");
const dbPW = pulumiConfig.requireSecret("DB_PASSWORD");
const storageAllocation = pulumiConfig.requireNumber("STORAGE_ALLOCATION");

const parameterGroup = new aws.rds.ParameterGroup(
  `${baseName}logicalreplicationgroup`,
  {
    family: `postgres${dbVersion.split(".")[0]}`,
    parameters: [
      {
        name: "rds.logical_replication",
        value: "1",
        applyMethod: "pending-reboot",
      },
    ],
  },
  { deleteBeforeReplace: false }
);

const database = new aws.rds.Instance(
  baseName,
  {
    allocatedStorage: storageAllocation,
    engine: "postgres",
    engineVersion: dbVersion,
    instanceClass: aws.rds.InstanceType.T3_Micro,
    username: dbUsername,
    password: dbPW,
    storageEncrypted: true,
    backupRetentionPeriod: 7,
    blueGreenUpdate: { enabled: true },
    skipFinalSnapshot: true,
    parameterGroupName: parameterGroup.name,
  },
  { dependsOn: [parameterGroup] }
);

export const database_arn = database.arn;
