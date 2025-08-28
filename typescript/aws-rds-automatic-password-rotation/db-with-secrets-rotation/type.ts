import * as aws from "@pulumi/aws";
import { Input, Output } from "@pulumi/pulumi";

export type SecretManagedRDSArgs = {
  clusterArgs: Omit<
    aws.rds.ClusterArgs,
    | "manageMasterUserPassword"
    | "masterUserSecretKmsKeyId"
    | "masterUsername"
    | "masterPassword"
  >;
  instances: Omit<aws.rds.ClusterInstanceArgs, "clusterIdentifier">[];
  basename: string;
  environmentName: string;
  publiclyAccessible: boolean;
  rotateUsers?: {
    primaryUsername: string;
    backupUsername: string;
    rotationSchedule?: string;
  };
  masterCredentialsConfiguration: {
    masterUsername: string;
    masterPassword?: Input<string>;
    rotationSchedule?: string;
  };
};
