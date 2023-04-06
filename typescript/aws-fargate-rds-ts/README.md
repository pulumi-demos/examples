# ECS Fargate Running Wordpress with RDS Backend

This example deploys two projects:
- `base-infra`: Deploys networking, RDS and an ECS cluster.
- `app-inra`: Deploys a load balancer and ECS task and service to run Wordpress.

# Demo Overview

This demo highlights the following:
- Typescript support: It is written in Typescript.
- Component Resources: Both projects use component resources.
- Pulumi secrets: `base-infra` can accept a `dbPassword` config value and so can be used to show a secret in config.
- Stack References: `app-infra` uses a stack reference to get values from `base-infra` to be able to launch on the ECS cluster and configure the Wordpress app with the RDS credentials.
- Project Level Config: Both projects have config set in the `Pulumi.yaml` file and can be shown to discuss Project Level config.

## Deploying the App

To deploy your infrastructure, follow the below steps.

### Prerequisites

1. [Install Pulumi](https://www.pulumi.com/docs/get-started/install/)
2. [Install Node.js](https://nodejs.org/en/download/)
3. [Configure AWS Credentials](https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/)

### Steps

After cloning this repo, from this working directory, run these commands:

1. Install the required Node.js packages in the top most folder:

    ```bash
    $ npm install
    ```

1. Change directory to `base-infra` and create a new stack, 

    ```bash
    $ pulumi stack init
    ```

1. Optionally set any of the config values - see `config.ts` for the various config values supported.

1. Launch the `base-infra` stack:

    ```bash
    $ pulumi up
    ```

1. Change directory to `app-infra` and create a new stack,

    ```bash
    $ pulumi stack init
    ```

1. Optionally set any of the config values - see `config.ts` for the various config values supported.

1. Launch the `app-infra` stack:

    ```bash
    $ pulumi up
    ```

1. The `app-infra` stack will output a URL that takes you to the Wordpress app.  
   NOTE: It may take a few minutes for the app to be up and running.