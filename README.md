# Yet another Examples repo?

There is a large collection of examples in the [Pulumi examples repo](https://github.com/pulumi/examples).
The examples in that repo are generally pretty simple and are generally meant to provide a good set of introductory use-cases that requires minimal setup and understanding.

This repo, [Pulumi-Demos examples](https://github.com/pulumi-demos/pulumi-deployments), is part of a github org used by the pre and post sales teams. The intent of this repo is to reflect larger scale and more involved use-cases and examples to demonstrate key Pulumi concepts and constructs.

## (Proposed) Requirements - THIS SECTION TO BE REMOVED WHEN REPO GOES PUBLIC
See and comment here: https://docs.google.com/document/d/1CWVYzXoC4Uy0cZhe7sVpKChqQyauMQrBT00xHlbknu0/edit 

## Use-Cases and Narratives
A quick reference of which stories can be told with which examples.
Each referenced folder includes a README with more details around the use-case and related narrative.

Path to Example         | Sec | CRs | MLCs | MS | UT | Notes
:---------------------- |:--- |:--- |:---- |:-- |:-- |:------
csharp/unit-testing     |     |     |      |    |:heavy_check_mark:| Both component resource unit-testing as well as stack unit-testing best practices.
csharp/aws-eks-base-infra |:heavy_check_mark:| | | | | Programmatic secrets to encrypt kubeconfig; Can be used as base K8s for a guestbook stack.
csharp/k8s-guestbook-app | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
multilanguage-packages | | |:heavy_check_mark:| | | Contains multilanguage packages used by other projects.
python/automation-api   |     |     |      |:heavy_check_mark:| | Shows automation API in Python.
python/aws-eks-base-infra |:heavy_check_mark:| | | | | Programmatic secrets to encrypt kubeconfig; Can be used as base K8s for a guestbook stack.
python/k8s-guestbook-app | | |:heavy_check_mark:|:heavy_check_mark:| | Uses stack references for base stack; Uses golang-based MLC.
python/aws-py-wordpress-fargate-rds |:heavy_check_mark:|:heavy_check_mark:||||Optional secret config for DB password; Components used for all parts of the project.
typescript/aws-ts-serverless | | | | | | Simplest pulumi program for super quick deployments.
yaml/aws-yaml-eks-guestbook |:heavy_check_mark:| |:heavy_check_mark:|:heavy_check_mark:| | Programmatic secrets to encrypt kubeconfig; Uses golang-based MLC.


Column Descriptions:
* Path to Example: Relative path to the examples main project code in this repo.
* Sec => Secrets: Example provides a good use-case to show setting and use of input and/or output secrets.
* CRs => Component Resources (CRs): Example uses same-language component resources.
* MLCs => Multilanguage Components: Example uses multilanguage component resources.
* MS => Multistack: Example uses stack references.
* UT => Unit Testing: Example demonstrates unit testing.


