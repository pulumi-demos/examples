# Introduction
Demonstraction of a full-featured highly available EC2 AutoScaling web deployment (nginx), including ACM Certificate and Route53 subdomain management.

# Overview
This demo highlights the following:
- C# support
- Multistack Architecture: Uses stack reference to a base infrastructure stack VPC, to simulate deployment of applications into networking infrastructure maintained separately from the web application.

# Prerequisites
- AWS Account with a propery configured Route53 hosted zone
  - This demo will add an A record for the load balancer to the hosted zone and a corresponding ACM certificate for SSL.
- A deployed stack which instantiates a VPC
  - Stack must output the following values:
    - `VpcId`
    - `CidrBlock`
    - `PrivateSubnetIds`
    - `PublicSubnetIds`

# Setup
- `pulumi config set aws:region us-west-2`
- `pulumi config set org ORGANIZATION`
  - Where *ORGANIZATION* is the name of the org in which the stack is launched.

# ESC (environment, secrets, configuration)
This project assumes the use of ESC for credentials and configuration. The default environments are `aws-webdemo-dev` and `aws-webdemo-prod`

If the ESC environment needs to be recreated, it should look like:

```yaml
imports:
  - aws # base ESC environment for AWS AWS OIDC
values:
  pulumiConfig:
    hostedZoneName: pulumi-ce.team
    subDomain: webdemodev
    vpcStack: team-ce/aws-cs-landingzone/dev
    instanceCount: 2
```

Note that we are reading config values from the ESC environment.  We can override these locally with `pulumi config set KEY VALUE` if necessary.