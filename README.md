# Yet another Examples repo?

There is a large collection of examples in the [Pulumi examples repo](https://github.com/pulumi/examples).
The examples in that repo are generally pretty simple and are generally meant to provide a good set of introductory use-cases that requires minimal setup and understanding.

This repo, [Pulumi-Demos examples](https://github.com/pulumi-demos/pulumi-deployments), is part of a github org used by the pre and post sales teams. The intent of this repo is to reflect larger scale and more involved use-cases and examples to demonstrate key Pulumi concepts and constructs.

## (Proposed) Requirements
See and comment here: https://docs.google.com/document/d/1CWVYzXoC4Uy0cZhe7sVpKChqQyauMQrBT00xHlbknu0/edit 

## Use-Cases and Narratives
This section contains links to examples for specific use-cases or stories.  
Each referenced folder includes a README with more details around the use-case and related narrative.

### Unit-Testing
#### csharp/unit-testing
Can be used to discuss unit-testing best practices around two use-cases:
* component-resource unit-testing: You want to be able to ensure updates to a component resource does not violate its requirements (as enforced by unit tests).
* stack unit-testing: You want to ensure a stack is not creating resources with bad settings. 
