#### WAITING FOR https://github.com/pulumi/pulumi/issues/7360 

# Components Folder
A fundamental reusability construct in Pulumi is the [Component Resource](https://www.pulumi.com/docs/intro/concepts/resources/components/). Component Resources are used to create abstractions that encapsulate one or more base resource. They also provide a way of implementing best practices and only exposing inputs that users are allowed to maange.

Components can be augmented with schema and related information to create [Multilanguage Components](https://www.pulumi.com/docs/guides/pulumi-packages/). This allows you to write the component in one language, say, Python, and generate SDKs for the other languages supported by Pulumi (e.g. Typescript, C#, etc). 

This folder is focused on Component Resources for the parent directory's language. Multilanguage Components are managed at the top level of this repo.