# Yet another Examples repo?

There is a large collection of examples in the [Pulumi examples repo](https://github.com/pulumi/examples).
The examples in that repo are generally pretty simple and are generally meant to provide a good set of introductory use-cases that requires minimal setup and understanding.

This repo, [Pulumi-Demos examples](https://github.com/pulumi-demos/pulumi-deployments), is part of a github org used by the pre and post sales teams. The intent of this repo is to reflect larger scale and more involved use-cases and examples to demonstrate key Pulumi concepts and constructs.

## (Proposed) Requirements
See and comment here: https://docs.google.com/document/d/1CWVYzXoC4Uy0cZhe7sVpKChqQyauMQrBT00xHlbknu0/edit 

## Use-Cases and Narratives
A quick reference of which stories can be told with with examples.
Each referenced folder includes a README with more details around the use-case and related narrative.

Path to Example         | Sec | CRs | MLCs | UT | Notes
:---------------------- |:--- |:--- |:---- |:-- |:------
`csharp/unit-testing`     |     |     |      | :heavy_check_mark: | Both component resource unit-testing as well as stack unit-testing best practices.

Column Descriptions:
* Path to Example: Relative path to the examples main project code in this repo.
* Sec => Secrets: Example provides a good use-case to show setting and use of input and/or output secrets.
* CRs => Component Resources (CRs): Example uses same-language component resources.
* MLCs => Multilanguage Components: Example uses multilanguage component resources.
* UT => Unit Testing: Example demonstrates unit testing.

#### csharp/unit-testing
Can be used to discuss unit-testing best practices around two use-cases:
* component-resource unit-testing: You want to be able to ensure updates to a component resource does not violate its requirements (as enforced by unit tests).
* stack unit-testing: You want to ensure a stack is not creating resources with bad settings. 

### Multilanguage Packages Stories
Examples that show the use of multilanguage packages.
### csharp/aws-cs-eks-guestbook
* Multi-stack deployment of a base k8s cluster and an app on the cluster.
* Uses golang-based `multilanguage-packages/pulumi-k8s-servicedeployment` multilanguage component to deploy a simple app to K8s.

### Stack References Stories
Examples that show stack references.

