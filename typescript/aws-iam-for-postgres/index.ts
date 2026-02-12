import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import { Vpc } from "./components/vpc";
import { EksCluster } from "./components/eks";
import { RdsCluster } from "./components/rds";
import { DbSetup } from "./components/db-setup";
import { K8sRdsDemoApp } from "./components/k8s-app";

// Constants
const NAMESPACE = "rds-demo";
const SERVICE_ACCOUNT_NAME = "rds-access-sa";
const DATABASE_NAME = "mydatabase";
const MASTER_USERNAME = "adminuser";
const IAM_DB_USERNAME = "iamuser";

// Get Pulumi config
const config = new pulumi.Config();
const dbMasterPassword = config.requireSecret("dbMasterPassword");

// Get current AWS region
const currentRegion = aws.getRegionOutput();

// Get availability zones dynamically
const availableAZs = aws.getAvailabilityZonesOutput({ state: "available" });

// Create VPC with networking (use first 2 available AZs)
const vpc = new Vpc("iam-postgres", {
  cidrBlock: config.get("vpcCidrBlock") || "10.0.0.0/16",
  availabilityZones: availableAZs.names.apply((names) => names.slice(0, 2)),
});

// Create EKS cluster
const eksCluster = new EksCluster("iam-postgres", {
  vpcId: vpc.vpc.id,
  publicSubnetIds: vpc.publicSubnets.map((s) => s.id),
  privateSubnetIds: vpc.privateSubnets.map((s) => s.id),
  nodeInstanceType: config.get("nodeInstanceType") || "t3.small",
  desiredNodeCount: config.getNumber("desiredNodeCount") || 1,
});

// Create RDS Aurora PostgreSQL cluster
// Note: Using public subnets for demo purposes so the PostgreSQL provider
// can connect from your local machine during deployment. See README for details.
const rdsCluster = new RdsCluster("iam-postgres", {
  vpcId: vpc.vpc.id,
  vpcCidrBlock: vpc.vpc.cidrBlock,
  subnetIds: vpc.publicSubnets.map((s) => s.id),
  databaseName: DATABASE_NAME,
  masterUsername: MASTER_USERNAME,
  masterPassword: dbMasterPassword,
  instanceClass: config.get("rdsInstanceClass") || "db.t4g.medium",
  engineVersion: config.get("rdsEngineVersion") || "17.4",
  iamDatabaseUser: IAM_DB_USERNAME,
});

// Set up database IAM user and permissions using PostgreSQL provider
const dbSetup = new DbSetup(
  "iam-postgres",
  {
    dbEndpoint: rdsCluster.cluster.endpoint,
    dbName: DATABASE_NAME,
    masterUsername: MASTER_USERNAME,
    masterPassword: dbMasterPassword,
    iamUsername: IAM_DB_USERNAME,
  },
  { dependsOn: [rdsCluster.instance] }
);

// Create IAM role for RDS access from Kubernetes
const rdsIamRole = rdsCluster.createIamRole(
  eksCluster.oidcProvider,
  NAMESPACE,
  SERVICE_ACCOUNT_NAME
);

// Create Kubernetes provider
const k8sProvider = new k8s.Provider("k8s-provider", {
  kubeconfig: eksCluster.kubeconfig,
});

// Create namespace
const namespace = new k8s.core.v1.Namespace(
  "rds-demo-namespace",
  {
    metadata: { name: NAMESPACE },
  },
  { provider: k8sProvider }
);

// Deploy the demo application with interactive UI
const app = new K8sRdsDemoApp(
  "iam-postgres",
  {
    provider: k8sProvider,
    namespace: namespace.metadata.name,
    serviceAccountName: SERVICE_ACCOUNT_NAME,
    iamRoleArn: rdsIamRole.arn,
    dbEndpoint: rdsCluster.cluster.endpoint,
    dbName: DATABASE_NAME,
    dbUser: IAM_DB_USERNAME,
    awsRegion: currentRegion.region,
    replicas: config.getNumber("appReplicas") || 1,
  },
  { dependsOn: [dbSetup, namespace] }
);

// Exports
export const kubeconfig = eksCluster.kubeconfig;
export const clusterName = eksCluster.cluster.name;
export const dbClusterEndpoint = rdsCluster.cluster.endpoint;
export const dbClusterReaderEndpoint = rdsCluster.cluster.readerEndpoint;
export const rdsAccessRoleArn = rdsIamRole.arn;
export const vpcId = vpc.vpc.id;
export const appUrl = app.appUrl;
