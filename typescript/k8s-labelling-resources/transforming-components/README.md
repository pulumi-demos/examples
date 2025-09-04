# Transforming Components Approach

This example demonstrates how to apply organization-wide labeling policies using **Pulumi transforms** with a single large component.

## How It Works

- **Single Component**: The `EKSResources` component creates all AWS and Kubernetes resources
- **Transform Function**: Uses Pulumi transforms to automatically inject additional labels
- **Runtime Label Injection**: Labels are added at deployment time without modifying component code

## Key Files

### `EKSResources.ts`

A comprehensive component that creates:

- Complete EKS cluster with VPC, subnets, and networking
- Kubernetes namespace and service with base labels
- Parameterized configuration for environment, team, and application settings

### `index.ts`

Instantiates the EKSResources component with a transform that automatically adds:

```typescript
owner: "infra-team";
```

to all Kubernetes resources (Namespace, Service).

## Transform Function

The transform automatically detects specific Kubernetes resource types and injects additional labels:

```typescript
transforms: [
  (args) => {
    if (
      args.type === "kubernetes:core/v1:Namespace" ||
      args.type === "kubernetes:core/v1:Service"
    ) {
      const props = { ...args.props };
      props.metadata = {
        ...props.metadata,
        labels: {
          ...(props.metadata?.labels || {}),
          owner: "infra-team",
        },
      };
      return { props, opts: args.opts };
    }
    return undefined;
  },
];
```

## Benefits

- **Centralized Policy**: Apply organization-wide labeling from one place
- **No Code Changes**: Add labels without modifying existing components
- **Consistent Application**: Ensures all resources get required organizational labels
- **Scalable**: Easy to apply transforms across large infrastructures

## Important Note

The transform function must be included on every instantiation of the EKSResources component where you want the additional labels applied. Transforms are not automatically applied across all uses of the component - they must be explicitly provided in the options for each instantiation.

## Usage

```typescript
const eksResources = new EKSResources(
  "tranform-eks",
  {
    clusterName: "tranform-cluster",
    environment: "dev",
    team: "backend",
    appName: "tranform-app",
    appImage: "nginx",
    appReplicas: 1,
  },
  {
    transforms: [
      /* your transform function */
    ],
  }
);
```

## Run This Example

```bash
pulumi install
pulumi up
```
