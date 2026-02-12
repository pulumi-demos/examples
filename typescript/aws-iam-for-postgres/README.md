# EKS with RDS IAM Authentication Example

This Pulumi project demonstrates how to set up Amazon EKS to connect to RDS Aurora PostgreSQL using IAM authentication. It showcases infrastructure-as-code patterns for configuring database users and permissions, and includes an interactive web application to demonstrate passwordless database access.

## What This Example Shows

This example demonstrates:

1. **Infrastructure-as-Code Database Configuration**

   - Using the `@pulumi/postgresql` provider to manage database users and permissions
   - Creating IAM-enabled database users directly from Pulumi code
   - Setting up fine-grained PostgreSQL privileges (schema, table, sequence permissions)
   - Configuring default privileges for future database objects

2. **AWS IAM Authentication for RDS**

   - Enabling IAM database authentication on Aurora PostgreSQL
   - Creating an IAM role with `rds-db:connect` permission
   - Using IRSA (IAM Roles for Service Accounts) to connect EKS pods to RDS
   - Generating temporary database tokens instead of using passwords

3. **Complete Infrastructure Setup**

   - VPC with public and private subnets across 2 availability zones
   - EKS cluster with OIDC provider for IRSA
   - RDS Aurora PostgreSQL (publicly accessible for demo purposes)
   - Security group with IP whitelisting for external access

4. **Interactive Demo Application**
   - Python web application with a browser-based UI
   - Create tables and insert data through the web interface
   - All database connections use IAM authentication tokens
   - Demonstrates real-world usage of passwordless database access

## How IAM Authentication Works

1. The Kubernetes ServiceAccount is annotated with an IAM role ARN
2. Pods using this ServiceAccount automatically receive AWS credentials via IRSA
3. The application uses `boto3` to generate a temporary database authentication token
4. This token (valid for 15 minutes) is used as the password to connect to PostgreSQL
5. No database passwords are stored in the application

## Key Files

- **`components/eks.ts`**: Creates the EKS cluster with an OIDC provider for IRSA (IAM Roles for Service Accounts), which enables pods to assume AWS IAM roles
- **`components/db-setup.ts`**: Uses the PostgreSQL Pulumi provider to create the IAM database user and configure permissions directly from infrastructure code
- **`components/rds.ts`**: Creates the Aurora PostgreSQL cluster with IAM authentication enabled and sets up the IAM role for EKS pods
- **`components/k8s-app.ts`**: Deploys the demo application with an interactive web UI that uses IAM tokens for database access
- **`index.ts`**: Orchestrates all components and shows how to wire everything together

## Why Is The Database Publicly Accessible?

This example makes the RDS instance publicly accessible (with IP whitelisting) because the [Pulumi PostgreSQL provider](https://www.pulumi.com/registry/packages/postgresql/) needs to connect directly to the database during `pulumi up` to create the IAM user and configure permissions. The provider runs on your local machine (or CI/CD environment), not inside the Kubernetes cluster.

This demonstrates an important pattern: when using infrastructure-as-code to manage database schema and permissions, your deployment environment needs network access to the database. In production, you have a few options:

1. **Keep Public and Lock Down IPs** - Keep the database public and allow specific IPs that you expect to do deployments.
2. **Run Pulumi from inside the VPC** - Execute deployments from an EC2 instance or CodeBuild
3. **Use alternative approaches** - Initialize the database using Kubernetes Jobs instead of the PostgreSQL provider

## Deployment

### Prerequisites

- AWS CLI configured with appropriate credentials
- Pulumi CLI installed
- Node.js and npm installed

### Steps

1. Install dependencies:

   ```bash
   pulumi install
   ```

2. Configure required settings:

   ```bash
   # Set your public IP for database access (required)
   pulumi config set myPublicIP $(curl -s https://checkip.amazonaws.com)

   # Set a secure master password for the database
   pulumi config set --secret dbMasterPassword "YourSecurePassword123!"

   # Optional: Configure AWS region (defaults to us-east-1)
   pulumi config set aws:region us-east-1
   ```

3. Deploy the infrastructure:

   ```bash
   pulumi up
   ```

4. Get the application URL:

   ```bash
   pulumi stack output appUrl
   ```

5. Open the URL in your browser to access the interactive demo:

   - Click "Create Table" to initialize the database schema
   - Add messages using the input form
   - All operations use IAM authentication (no passwords!)

   Or test via command line:

   ```bash
   curl http://<appUrl>/messages
   ```

## Outputs

After deployment, the following outputs are available:

- `kubeconfig`: EKS cluster configuration for kubectl
- `dbClusterEndpoint`: Primary database endpoint (read/write)
- `dbClusterReaderEndpoint`: Read-only endpoint
- `rdsAccessRoleArn`: IAM role ARN used for database access
- `vpcId`: VPC identifier
- `appUrl`: LoadBalancer URL for the demo application

## Security Considerations

This is a **demo setup** that prioritizes ease of testing over production security. It implements:

**Good practices shown:**

1. **No hardcoded credentials**: Database access uses IAM authentication
2. **Principle of least privilege**: IAM policy grants only `rds-db:connect` permission
3. **Infrastructure-as-code**: Database users and permissions managed via Pulumi
4. **Encryption in transit**: SSL/TLS required for database connections
5. **Short-lived credentials**: IAM tokens expire after 15 minutes

**For production, you should change:**

1. **Database accessibility**: Move RDS to private subnets (not publicly accessible)
2. **Remove IP whitelisting**: Rely on VPC security groups only
3. **Use secrets management**: Store master password in AWS Secrets Manager
4. **Enable encryption at rest**: Enable Aurora encryption
5. **Add monitoring**: Set up CloudWatch alarms for connection failures

## Cleanup

To destroy all resources:

```bash
pulumi destroy
```

This will remove all AWS resources created by this stack.

## Learning More

This example demonstrates several advanced patterns you can apply to your own projects:

1. **Using the PostgreSQL Pulumi provider**: See `components/db-setup.ts` for managing database schema and permissions as code
2. **IRSA (IAM Roles for Service Accounts)**: See how `components/rds.ts` creates the IAM role and `components/k8s-app.ts` annotates the ServiceAccount
3. **IAM token generation**: See the Python code in `components/k8s-app.ts` that shows how to generate and use IAM tokens with boto3

For more information:

- [Pulumi PostgreSQL Provider Documentation](https://www.pulumi.com/registry/packages/postgresql/)
- [AWS RDS IAM Database Authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)
