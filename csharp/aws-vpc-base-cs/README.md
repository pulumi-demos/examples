# Introduction
A basic VPC stack, used as a base for demonstration purposes.

# Overview
This demo highlights the following:
- C# support
- `@pulumi/awsx`

# Setup
- `pulumi config set org ORGANIZATION` where *ORGANIZATION* is the name of the org in which the stack is launched.
- Configuration:
  - `CidrBlock` (default: 10.1.0.0/20): The VPC CIDR range
  - `NumberOfAzs` (default: 2): Number of availability zones to use
  - `enableNAT` (default: true): Enable a NAT gateway for the Private subnet
  - `gatewayEndpointServices` (default ['s3']): List of endpoint services to enable on the VPC
  
# ESC (environment, secrets, configuration)
This project assumes the use of ESC for credentials and configuration. The default environments is expected to be `aws`

If the ESC environment needs to be recreated, it should look like:

```yaml
values:
  aws:
    creds:
      fn::open::aws-login:
        oidc:
          duration: 1h
          roleArn: arn:aws:iam::052848974346:role/pulumi-demo-org-deployments-oidc
          sessionName: pulumi-environments-session
  environmentVariables:
    AWS_ACCESS_KEY_ID: ${aws.creds.accessKeyId}
    AWS_SECRET_ACCESS_KEY: ${aws.creds.secretAccessKey}
    AWS_SESSION_TOKEN: ${aws.creds.sessionToken}
    AWS_REGION: us-west-2
```

Note that we are reading config values from the ESC environment.  We can override these locally with `pulumi config set KEY VALUE` if necessary.