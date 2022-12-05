# Demo Overview
**NOTE** This demo uses the `K8sServiceDeployment` package generated in the multilanguage-packages folder. 

This demo highlights the following:
- C# support: It is written in C#.
- Multilanguage Packages: It uses a C# package generated from a Golang provider.
- Multistack Architecture: Deploys base EKS cluster infrastructure and the layers on a "Guestbook" application using multiple services deployed using the `K8sServiceDeployment` package.
- Uses programmatic secrets to encrypt the kubeconfig output.

# Demo Steps
## Install Multilanguage Plugin
This demo requires the `K8sServiceDeployment` SDK and related plugin found in the multilanguage-packages folder.

* Install the MLC plugin:
  ```bash
  pulumi plugin install resource k8s-servicedeployment v0.0.3 -f PACKAGE_TARBALL_PATH
  ```
  * `PACKAGE_TARBALL_PATH` will be the path to the applicable tgz file found in `multilanguage-packages/pulumi-k8s-servicedeployment/bin/`
  
## Prelaunch EKS Cluster
It takes a solid 10-15 minutes for EKS cluster to launch and so you should launch the EKS cluster stack ahead of the demo.

See `eks-base-infra/README.md` for deployment steps.

## Prepare the GuestBook Service Project
The GuestBook stack launches quickly - only takes about a minute to come up and so can be run during the demo itself.   

See `guestbook-app/README.md` for deployment steps.
