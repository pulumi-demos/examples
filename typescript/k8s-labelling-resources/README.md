# EKS and Kubernetes Resources with Labels Example

This example demonstrates different approaches for implementing consistent labeling strategies across EKS and Kubernetes resources using Pulumi. It shows how to enforce labeling best practices through two distinct architectural patterns.

## What's Included

The example creates a complete EKS cluster with the following resources:

- **AWS EKS Cluster** with IAM roles and policies
- **VPC Infrastructure** (VPC, subnets, internet gateway, route tables)
- **Kubernetes Resources** (Namespace, Service)
- **Consistent Labeling** across all resources for organization and management

## Project Structure

### Root Level (`index.ts`)

The baseline implementation that creates all resources manually with hardcoded labels. This serves as the starting point to understand what we're refactoring.

### `best-practices-components/`

**Micro-Components Approach** - Refactored into small, focused components that enforce labeling best practices:

- **`components/sharedTypes.ts`** - Defines TypeScript interfaces for different label types:

  - `NamespaceLabels` - environment, team
  - `ServiceLabels` - app, tier

- **`components/namespace.ts`** - Component that enforces namespace-specific labels
- **`components/service.ts`** - Component that enforces service-specific labels
- **`index.ts`** - Uses the micro-components to build the infrastructure

**Benefits:**

- Type safety through TypeScript interfaces
- Enforces required labels at compile time
- Reusable components with clear contracts
- Easy to maintain and extend specific resource types

### `transforming-components/`

**Transform Approach** - Uses one large component with Pulumi transforms to add labels:

- **`EKSResources.ts`** - Single component resource that creates the entire EKS infrastructure
- **`index.ts`** - Uses transforms to automatically add an `owner: "infra-team"` label to all Kubernetes resources

**Benefits:**

- Centralized infrastructure management
- Automatic label injection without modifying individual resources
- Simpler to apply organization-wide labeling policies
- Less boilerplate code

**Important Note:** Transforms must be included on every instantiation of the component where the additional labels are desired. They are not automatically applied across all uses of the component.

## Key Differences

| Aspect                | Micro-Components                                         | Transform                                  |
| --------------------- | -------------------------------------------------------- | ------------------------------------------ |
| **Architecture**      | Multiple small, focused components                       | Single large component with transforms     |
| **Label Enforcement** | Compile-time through TypeScript types                    | Runtime through transforms                 |
| **Customization**     | Highly customizable per resource type                    | Uniform policies across resource types     |
| **Maintenance**       | More files to maintain                                   | Centralized logic                          |
| **Type Safety**       | Strong typing for each resource's labels                 | Labels added dynamically                   |
| **Use Case**          | When you need different labeling strategies per resource | When you need consistent org-wide policies |

## Getting Started

1. Choose your preferred approach:

   ```bash
   # For micro-components approach
   cd best-practices-components

   # For transform approach
   cd transforming-components
   ```

2. Install dependencies:

   ```bash
   pulumi install
   ```

3. Deploy the infrastructure:
   ```bash
   pulumi up
   ```

## When to Use Each Approach

**Use Micro-Components when:**

- You need different labeling requirements for different resource types
- Type safety is critical for your team
- You want to enforce specific label schemas
- You have complex labeling logic per resource

**Use Transforms when:**

- You want to apply organization-wide labeling policies
- You need to add labels without modifying existing code
- You prefer centralized infrastructure management
- You want to minimize code duplication
- You don't want the transform applied to every instantiation of the component OR you will add it to each instantiation
