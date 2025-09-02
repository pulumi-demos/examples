import * as pulumi from "@pulumi/pulumi";
import { NamespaceLabels } from "./sharedTypes";
import * as k8s from "@pulumi/kubernetes";

export interface NamespaceArgs {
  labels: NamespaceLabels;
}

export class Namespace extends pulumi.ComponentResource {
  public readonly namespace: k8s.core.v1.Namespace;

  constructor(
    name: string,
    args: NamespaceArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:k8s:Namespace", name, {}, opts);

    this.namespace = new k8s.core.v1.Namespace(
      name,
      {
        metadata: {
          labels: args.labels,
        },
      },
      { provider: opts?.provider }
    );

    this.registerOutputs({
      namespace: this.namespace,
    });
  }
}
