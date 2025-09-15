# SecretManagedRDS Pulumi Module

A Pulumi component module that creates an AWS RDS Aurora cluster with automatic secret rotation capabilities using [Pulumi ESC](https://www.pulumi.com/docs/esc/reference/rotators/) (Environment, Secrets, and Configuration).

## Features

- 🔐 **Automatic secret management** - Integrates with AWS Secrets Manager for master user credentials
- 🔄 **Database user rotation** - Supports rotating additional database users through Pulumi ESC
- 🔒 **Secure networking** - Configurable for private VPC access with Lambda-based rotation
- 🌐 **Public or private access** - Supports both publicly accessible and VPC-private databases
- ⚡ **Aurora PostgreSQL/MySQL** - Works with both Aurora database engines

## Architecture

The module creates several components:

- **RDS Aurora Cluster** with configurable instances
- **AWS Secrets Manager** integration for master user credentials
- **Pulumi ESC Environments** for managing rotating database users
- **Lambda Rotator** (for private databases) to handle user rotation within VPC
- **IAM roles and policies** for secure access

## Usage

### Examples

#### Full-Featured Private Database with User Rotation

```typescript
import { SecretManagedRDS } from "./db-with-secrets-rotation";
import * as aws from "@pulumi/aws";

// Creates: RDS cluster + Lambda rotator + 2 ESC environments + IAM roles + Security groups
new SecretManagedRDS(
  "production-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
      vpcSecurityGroupIds: ["sg-example123"],
      dbSubnetGroupName: "my-db-subnet-group",
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
      },
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
      },
    ],
    basename: "prodapp",
    masterCredentialsConfiguration: {
      masterUsername: "admin",
      rotationSchedule: "cron(0 2 * * ? *)", // Rotate master at 2 AM daily
    },
    publiclyAccessible: false, // Enables Lambda rotator for VPC access
    environmentName: "production",
    rotateUsers: {
      primaryUsername: "app_user_1",
      backupUsername: "app_user_2",
      rotationSchedule: "0 0 * * *", // Rotate app users daily at midnight
    },
  },
  {}
);
```

#### Public Database with User Rotation (No Lambda)

```typescript
// Creates: RDS cluster + 2 ESC environments (no Lambda rotator needed)
new SecretManagedRDS(
  "public-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraMysql,
      skipFinalSnapshot: true,
    },
    instances: [
      {
        engine: "aurora-mysql",
        instanceClass: aws.rds.InstanceType.T3_Medium,
      },
    ],
    basename: "publicapp",
    masterCredentialsConfiguration: {
      masterUsername: "root",
      rotationSchedule: "cron(0 3 ? * SUN *)", // Weekly on Sunday at 3 AM
    },
    publiclyAccessible: true, // No Lambda rotator - ESC handles rotation directly
    environmentName: "staging",
    rotateUsers: {
      primaryUsername: "webapp",
      backupUsername: "webapp_backup",
      rotationSchedule: "0 1 * * 0", // Weekly on Sunday at 1 AM
    },
  },
  {}
);
```

#### Simple Database with Only Master User Management

```typescript
// Creates: RDS cluster + AWS Secrets Manager rotation (no ESC environments)
new SecretManagedRDS(
  "simple-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.T3_Medium,
      },
    ],
    basename: "simpleapp",
    masterCredentialsConfiguration: {
      masterUsername: "postgres",
      rotationSchedule: "cron(0 2 ? * MON *)", // Weekly on Monday at 2 AM
    },
    publiclyAccessible: false,
    environmentName: "development",
    // No rotateUsers - only master user rotation via AWS Secrets Manager
  },
  {}
);
```

#### Minimal Database with Manual Password Management

```typescript
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config("app");
const dbPassword = config.getSecret("db-password") || "fallback-password";

// Creates: Basic RDS cluster only (no rotation, no ESC environments)
new SecretManagedRDS(
  "manual-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.T3_Small,
      },
    ],
    basename: "manualapp",
    masterCredentialsConfiguration: {
      masterUsername: "admin",
      masterPassword: dbPassword, // Manually managed password
      // No rotationSchedule - manual password management
    },
    publiclyAccessible: true,
    environmentName: "test",
    // No rotateUsers - no additional user rotation
  },
  {}
);
```

#### Auto-Generated Password with User Rotation

```typescript
// Creates: RDS cluster + auto-generated password + 2 ESC environments + Lambda rotator
new SecretManagedRDS(
  "auto-password-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.T3_Medium,
      },
    ],
    basename: "autoapp",
    masterCredentialsConfiguration: {
      masterUsername: "postgres",
      // No masterPassword or rotationSchedule - password auto-generated and stored
    },
    publiclyAccessible: false,
    environmentName: "development",
    rotateUsers: {
      primaryUsername: "dev_user",
      backupUsername: "dev_user_backup",
      rotationSchedule: "0 2 * * 1", // Weekly on Monday at 2 AM
    },
  },
  {}
);
```

#### Multi-Instance Production Cluster

```typescript
// Creates: High-availability RDS cluster with 3 instances + full rotation setup
new SecretManagedRDS(
  "ha-production-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      engineVersion: "15.4",
      skipFinalSnapshot: false,
      finalSnapshotIdentifier: "ha-prod-final-snapshot",
      backupRetentionPeriod: 30,
      preferredBackupWindow: "03:00-04:00",
      preferredMaintenanceWindow: "sun:04:00-sun:05:00",
      enabledCloudwatchLogsExports: ["postgresql"],
      deletionProtection: true,
      vpcSecurityGroupIds: ["sg-prod-db-example"],
      dbSubnetGroupName: "production-db-subnet-group",
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_XLarge,
        promotionTier: 0, // Primary instance
      },
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
        promotionTier: 1, // Replica 1
      },
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
        promotionTier: 1, // Replica 2
      },
    ],
    basename: "prod-cluster",
    masterCredentialsConfiguration: {
      masterUsername: "admin",
      rotationSchedule: "cron(0 3 ? * SUN *)", // Weekly maintenance window
    },
    publiclyAccessible: false,
    environmentName: "production-ha",
    rotateUsers: {
      primaryUsername: "app_primary",
      backupUsername: "app_secondary",
      rotationSchedule: "0 2 ? * SUN *", // Before master rotation
    },
  },
  {}
);
```

#### MySQL Development Database

```typescript
// Creates: MySQL Aurora cluster with ESC user rotation
new SecretManagedRDS(
  "mysql-dev-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraMysql,
      engineVersion: "8.0.mysql_aurora.3.04.0",
      skipFinalSnapshot: true,
      backupRetentionPeriod: 7,
    },
    instances: [
      {
        engine: "aurora-mysql",
        instanceClass: aws.rds.InstanceType.T3_Small,
      },
    ],
    basename: "mysqldev",
    masterCredentialsConfiguration: {
      masterUsername: "root",
      rotationSchedule: "cron(0 4 ? * SAT *)", // Weekly on Saturday
    },
    publiclyAccessible: true,
    environmentName: "mysql-development",
    rotateUsers: {
      primaryUsername: "devapp",
      backupUsername: "devapp_alt",
      rotationSchedule: "0 3 ? * SAT *", // Before master rotation
    },
  },
  {}
);
```

#### Database with Custom VPC and Security Configuration

```typescript
// Creates: RDS cluster in custom VPC with enhanced security + Lambda rotator
const customVpc = new aws.ec2.Vpc("custom-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
});

const dbSubnetGroup = new aws.rds.SubnetGroup("db-subnet-group", {
  subnetIds: [subnet1.id, subnet2.id], // Your private subnets
  tags: { Name: "Custom DB subnet group" },
});

const dbSecurityGroup = new aws.ec2.SecurityGroup("db-sg", {
  vpcId: customVpc.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      cidrBlocks: ["10.0.0.0/16"],
    },
  ],
});

new SecretManagedRDS(
  "custom-vpc-db",
  {
    clusterArgs: {
      engine: aws.rds.EngineType.AuroraPostgresql,
      skipFinalSnapshot: true,
      vpcSecurityGroupIds: [dbSecurityGroup.id],
      dbSubnetGroupName: dbSubnetGroup.name,
      storageEncrypted: true,
      kmsKeyId: "alias/aws/rds", // Use AWS managed KMS key
    },
    instances: [
      {
        engine: "aurora-postgresql",
        instanceClass: aws.rds.InstanceType.R6G_Large,
        performanceInsightsEnabled: true,
        monitoringInterval: 60,
      },
    ],
    basename: "customvpc",
    masterCredentialsConfiguration: {
      masterUsername: "dbadmin",
      rotationSchedule: "cron(0 2 ? * TUE *)",
    },
    publiclyAccessible: false, // Lambda rotator will be deployed in VPC
    environmentName: "custom-environment",
    rotateUsers: {
      primaryUsername: "api_user",
      backupUsername: "api_user_backup",
      rotationSchedule: "0 1 ? * TUE *",
    },
  },
  {}
);
```

### Configuration Options

#### `SecretManagedRDSArgs`

| Property                         | Type                            | Required | Description                                          |
| -------------------------------- | ------------------------------- | -------- | ---------------------------------------------------- |
| `clusterArgs`                    | `aws.rds.ClusterArgs`           | ✅       | RDS cluster configuration (excluding managed fields) |
| `instances`                      | `aws.rds.ClusterInstanceArgs[]` | ✅       | Array of cluster instances to create                 |
| `basename`                       | `string`                        | ✅       | Base name for resources and database name            |
| `environmentName`                | `string`                        | ✅       | Pulumi ESC environment name for rotation             |
| `publiclyAccessible`             | `boolean`                       | ✅       | Whether the database is publicly accessible          |
| `masterCredentialsConfiguration` | `object`                        | ✅       | Master user configuration                            |
| `rotateUsers`                    | `object`                        | ❌       | Additional user rotation configuration               |

#### Master Credentials Configuration

```typescript
masterCredentialsConfiguration: {
  masterUsername: string;           // Master username
  masterPassword?: Input<string>;   // Optional password (auto-generated if not provided)
  rotationSchedule?: string;        // Optional cron expression for master rotation
}
```

#### Rotate Users Configuration

```typescript
rotateUsers?: {
  primaryUsername: string;      // Primary application username
  backupUsername: string;       // Backup username for rotation
  rotationSchedule?: string;    // Cron expression for user rotation
}
```

## How It Works

### Master User Rotation

When `masterCredentialsConfiguration.rotationSchedule` is provided:

1. RDS cluster is configured with AWS-managed master user password
2. AWS Secrets Manager handles automatic rotation using the provided schedule
3. Credentials are stored in AWS Secrets Manager

### Application User Rotation

When `rotateUsers` is configured:

1. **Private databases**: A Lambda function is deployed in your VPC to handle rotation
2. **Public databases**: Pulumi ESC handles rotation directly
3. Two Pulumi ESC environments are created:
   - Credentials environment: Stores master user credentials
   - Rotation environment: Manages the rotating application users
4. Application users are rotated according to the schedule using the two-user pattern

### Security Model

- Master credentials stored in AWS Secrets Manager
- Application user credentials managed through Pulumi ESC
- Lambda rotator uses OIDC authentication with minimal IAM permissions
- Network isolation for private databases through VPC configuration

## Requirements

- Pulumi CLI with AWS provider
- Node.js and TypeScript
- AWS account with appropriate permissions
- VPC configuration (for private databases)

## Dependencies

This module uses:

- `@pulumi/aws` - AWS resources
- `@pulumi/pulumi` - Core Pulumi functionality
- `@pulumi/pulumiservice` - Pulumi ESC environments
- `@pulumi/random` - Password generation
- `js-yaml` - YAML configuration generation
