# Blue/Green Deployment Updates for Postgres on RDS

A Postgres RDS deployment that uses blue/green updates for minimal downtime. Please refer to the AWS Documentation on blue/green deployments for more details on the update strategy: [Using Amazon RDS Blue/Green Deployments for database updates](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html). Also refer to [Low-Downtime Updates (Pulumi)](https://www.pulumi.com/registry/packages/aws/api-docs/rds/instance/#low-downtime-updates) for information on the implementation.

When `blueGreenUpdate` is enabled and the database is updated, the program starts by creating a blue/green deployment to maintain availability. Then, it performs the requested update on the green instance, performs a guardrail check, promotes the green instance, and finally deletes the old instance and removes the blue/green deployment. This leaves just the updated database running with minimal downtime during the update.

> :warning:
> This will not deploy and maintain a blue/green deployment. The blue/green deployment is temporarily created for the update and automatically removed afterwards. The green deployment is automatically promoted, so you will not have the chance to do custom testing before promoting it.

> :warning:
> Creating, updating, and deleting this stack may take up to 40 minutes.

## Get Started

To complete the initial deployment, you will need to configure your environment and deploy the postgres instance. Start by running the following commands to configure your stack:

```bash
npm install
pulumi stack init stack_name // replace "stack_name" with the stack name of your choice
```

Review the configuration that is now in Pulumi.yaml (where stack_name is your stack's name) to ensure it matches the desired initial configuration. You will have to run `pulumi config set DB_PASSWORD --secret <password>` to securely set your database password. Use `pulumi config set PARAMETER_NAME DESIRED_VALUE` to overwrite any of the other configuration settings for your stack.

After everything is configured correctly, run `pulumi up` to deploy your database.

## Update the Parameter Group

[AWS Docs on Changing Parameter Group](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-creating.html#blue-green-deployments-parameters)

> :warning:
> Removing the rds.logical_replication parameter from the group (or omitting it from a new group) may cause issues for future blue/green updates since it is a requirement for setting up blue/green deployments

Update the desired configuration on the parameterGroup resource or create a new parameter group and update the parameterGroupName of the instance to match.

Run `pulumi up` and you should see a blue/green deployment with a new instance creating. Once the green instance is up, it'll update itself and the program will promote it to be the main deployment and clean up.

## Update the engine version

[AWS Docs on Updating Engine Version](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-creating.html#blue-green-deployments-engine-version)

> :warning:
> The parameter group must be updated to the same postgres family that the instance will use. This is done automatically in this program.

In the Pulumi.stack_name.yaml file, update DB_VERSION to the desired version. This can also be done by running `pulumi config set DB_VERSION desired_version`.

Then, run `pulumi up` to perform the update.

## Modify storage and performance settings

[AWS Docs on Storage Modification](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments-creating.html#blue-green-deployments-resize)

In the Pulumi.stack_name.yaml file, update STORAGE_ALLOCATION to the desired GiB. This can also be done by running `pulumi config set STORAGE_ALLOCATION desired_capacity`. desired_capacity should be a number from 20 to 6144 that indicates the GiB of storage that you'll need.

You may also add any other storage configurations from [aws.rds.Instance](https://www.pulumi.com/registry/packages/aws/api-docs/rds/instance/)

Then, run `pulumi up` to perform the update.
