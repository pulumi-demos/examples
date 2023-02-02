# Amazon EKS Cluster

This example deploys an EKS Kubernetes cluster with an EBS-backed StorageClass and deploys the Kubernetes Dashboard into the cluster.

# Demo Overview

This demo highlights the following:
- Typescript support: It is written in Typescript.
- Pulumi packages: awsx and eks
- Uses programmatic secrets to encrypt the kubeconfig output.
- Can be used in conjunction with one of the guestbook project to demonstrate, among other things, stack references.

## Deploying the App

To deploy your infrastructure, follow the below steps.

### Prerequisites

1. [Install Pulumi](https://www.pulumi.com/docs/get-started/install/)
2. [Install Node.js](https://nodejs.org/en/download/)
3. [Configure AWS Credentials](https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/)
4. [Install `aws-iam-authenticator`](https://docs.aws.amazon.com/eks/latest/userguide/install-aws-iam-authenticator.html)

### Steps

After cloning this repo, from this working directory, run these commands:

1. Install the required Node.js packages:

    ```bash
    $ npm install
    ```

2. Create a new stack, which is an isolated deployment target for this example:

    ```bash
    $ pulumi stack init
    ```

3. Set the required configuration variables for this program:

    ```bash
    $ pulumi config set aws:region us-west-2
    ```

   We recommend using `us-west-2` to host your EKS cluster as other regions (notably `us-east-1`) may have capacity
   issues that prevent EKS clusters from creating:

    ```
    Diagnostics:
      aws:eks:Cluster: eksCluster
        error: Plan apply failed: creating urn:pulumi:aws-ts-eks-example::aws-ts-eks::EKSCluster$aws:eks/cluster:Cluster::eksCluster: error creating EKS Cluster (eksCluster-233c968): UnsupportedAvailabilityZoneException: Cannot create cluster 'eksCluster-233c968' because us-east-1a, the targeted availability zone, does not currently have sufficient capacity to support the cluster. Retry and choose from these availability zones: us-east-1b, us-east-1c, us-east-1d
            status code: 400, request id: 9f031e89-a0b0-11e8-96f8-534c1d26a353
    ```

    We are tracking enabling the creation of VPCs limited to specific AZs to unblock this in `us-east-1`: pulumi/pulumi-awsx#32

4. Stand up the EKS cluster, which will also deploy the Kubernetes Dashboard:

    ```bash
    $ pulumi up
    ```

5. After 10-15 minutes, your cluster will be ready, and the kubeconfig JSON you'll use to connect to the cluster will
   be available as an output. You can save this kubeconfig to a file like so:

    ```bash
    $ pulumi stack output kubeconfig --show-secrets >kubeconfig.json
    ```

    Once you have this file in hand, you can interact with your new cluster as usual via `kubectl`:

    ```bash
    $ KUBECONFIG=./kubeconfig.json kubectl get nodes
    ```
