# Introduction
Deploys Guestbook app and related containers on an K8s cluster deployed via another stack.

# Demo Overview
**NOTE** This demo uses the `K8sServiceDeployment` package generated in the multilanguage-packages folder. 

This demo highlights the following:
- Typescript support: It is written in typescript.
- Multilanguage Packages: It uses a python module package generated from a multilanguage component written in Golang. 
- Multistack Architecture: Uses stack reference to a k8s base infrastructure stack and layers on a "Guestbook" application using multiple services deployed using the `K8sServiceDeployment` multilanguage package.

# Launch the base infrastructure stack
Use one of the "k8s base infra" projects (e.g. csharp/aws-eks-base-infra, or python/aws-eks-base-infra). See the k8s project for instructions on how to launch the K8s stack this guestbook project relies on.

# Prepare the Python Virtual Environment
```bash
    cd guestbook-app-py
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
```

# Setup
- `pulumi stack init demo/dev` 
- `pulumi config set aws:region us-east-1`
- `pulumi config set org ORGANIZATION`
  - Where *ORGANIZATION* is the name of the org in which the K8s base stack is launched.
- `pulumi config set k8sProject guestbook-base-eks-infra-py`
  - You can use any of the "base infra" projects in this repo or any K8s project that deploys a K8s cluster and outputs `kubeconfig`.

# Launch and Use
## Prepare the GuestBook Service Project
The `guestbook-app` uses the python `pulumi_k8s_servicedeployment` package sdk generated in the multilanguage-packages folder. Therefore you need to set up your environment to be able to use it. The SDK is automatically installed via `requirements.txt`, however the plugin needs to be installed for the SDK to work.
- Find the `demos/multilanguage-packages/pulumi-k8s-servicedeployment/bin` directory
  - Look at the gzip tarballs in there and note the path to the one for your machine.
  - If you don't see a tarball for your machine, see the `gen_provider_plugin` target in `Makefile` for the package.
- run `pip list` to see the version of the `pulumi-k8s-servicedeployment` sdk and note the VERSION
- Install the package's plugin:
  ```bash
  pulumi plugin install resource k8s-servicedeployment v0.0.5 -f PACKAGE_TARBALL_NOTED_ABOVE
  ```
  NOTE: use the VERSION retrieved from the `pip list` above. 

- OPTIONALLY: Instead of installing the plugin, you can do the following in a terminal window opened in the folder:
  - `export PATH=$PATH:<PKG_DIR>/bin`
    - Where <PKG_DIR> is the path to the `pulumi-k8s-servicedeployment` package noted above
    - This is done so the pulumi engine can find the package binary (aka plugin).

## Lauch the GuestBook Stack
```bash
pulumi up
```