# Yet another Examples repo?

There is a large collection of examples in the [Pulumi examples repo](https://github.com/pulumi/examples).
The examples in that repo are generally pretty simple and are generally meant to provide a good set of introductory use-cases that requires minimal setup and understanding.

This repo, [Pulumi-Demos examples](https://github.com/pulumi-demos/pulumi-deployments), is part of a github org used by the pre and post sales teams. The intent of this repo is to reflect larger scale and more involved use-cases and examples to demonstrate key Pulumi concepts and constructs.

## Use-Cases and Narratives
A quick reference of which stories can be told with which examples.
Each referenced folder includes a README with more details around the use-case and related narrative.

Path to Example         | Sec | CRs | MLCs | MS | UT | Notes
:---------------------- |:--- |:--- |:---- |:-- |:-- |:------
csharp/unit-testing     |     |     |      |    |:heavy_check_mark:| Both component resource unit-testing as well as stack unit-testing best practices.
csharp/aws-eks-base-infra-cs |:heavy_check_mark:| | | | | Programmatic secrets to encrypt kubeconfig; Can be used as base K8s for a guestbook stack.
csharp/k8s-guestbook-app-cs | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
go/aws-eks-base-infra-go |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component for IAM; Can be used as base K8s for a guestbook stack.
go/k8s-guestbook-app-go | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
multilanguage-packages | | |:heavy_check_mark:| | | Contains multilanguage packages used by other projects.
python/automation-api   |     |     |      |:heavy_check_mark:| | Shows automation API in Python.
python/aws-eks-base-infra-py |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component for VPC; Can be used as base K8s for a guestbook stack.
python/aws-py-wordpress-fargate-rds |:heavy_check_mark:|:heavy_check_mark:||||Optional secret config for DB password; Components used for all parts of the project.
python/azure-aks-base-infra-py |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component for AKS cluster; Can be used as base K8s for a guestbook stack.
python/gcp-gke-base-infra-py |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component resource; Can be used as base K8s for a guestbook stack.
python/k8s-guestbook-app-py | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
typescript/aws-eks-base-infra-ts |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Config secret for DB password; Component for DB; Can be used as base K8s for a guestbook stack.
typescript/aws-ts-serverless | | | | | | Simplest pulumi program for super quick deployments.
typescript/aws-fargate-rds-ts |:heavy_check_mark:|:heavy_check_mark:| |:heavy_check_mark:| | Can be used to show config secrets, component resources, multi-stack and stack referenes.
typescript/azure-aks-base-infra-ts |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component for AKS cluster; Can be used as base K8s for a guestbook stack.
typescript/gcp-gke-base-infra-ts |:heavy_check_mark:|:heavy_check_mark:| | | | Programmatic secrets to encrypt kubeconfig; Component resource; Can be used as base K8s for a guestbook stack.
typescript/k8s-guestbook-app-ts| | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
yaml/k8s-guestbook-app-yaml | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.


Column Descriptions:
* Path to Example: Relative path to the examples main project code in this repo.
* Sec => Secrets: Example provides a good use-case to show setting and use of input and/or output secrets.
* CRs => Component Resources (CRs): Example uses same-language component resources.
* MLCs => Multilanguage Components: Example uses multilanguage component resources.
* MS => Multistack: Example uses stack references.
* UT => Unit Testing: Example demonstrates unit testing.


