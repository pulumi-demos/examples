# Best Practices Components Approach

This example demonstrates how to enforce Kubernetes labeling best practices through **micro-components** with TypeScript type safety.

## How It Works

- **Type-Safe Labels**: Uses TypeScript interfaces to define required labels for each resource type
- **Focused Components**: Each Kubernetes resource (Namespace, Service) has its own component
- **Compile-Time Validation**: Labels are validated at compile time, preventing missing or incorrect labels

## Components

### `components/sharedTypes.ts`

Defines TypeScript interfaces for different label requirements:

```typescript
NamespaceLabels: {
  environment, team;
}
ServiceLabels: {
  app, tier;
}
```

### `components/namespace.ts`

Creates namespaces with enforced environment and team labels.

### `components/service.ts`

Creates services with enforced app and tier labels.

## Benefits

- **Type Safety**: Compiler prevents missing required labels
- **Reusable**: Components can be used across multiple projects
- **Maintainable**: Each component has a single responsibility
- **Extensible**: Easy to add new label requirements per resource type

## Usage

```typescript
const namespace = new Namespace("my-namespace", {
  labels: {
    environment: "prod",
    team: "platform",
  },
});
```

## Run This Example

```bash
npm install
pulumi up
```
