import * as pulumi from "@pulumi/pulumi";
import { ServiceLabels } from "./sharedTypes";
import * as k8s from "@pulumi/kubernetes";

export interface ServiceArgs {
  ns: k8s.core.v1.Namespace;
  type: pulumi.Input<string>;
  labels: ServiceLabels;
  ports: pulumi.Input<pulumi.Input<k8s.types.input.core.v1.ServicePort>[]>;
}

export class Service extends pulumi.ComponentResource {
  public readonly service: k8s.core.v1.Service;

  constructor(
    name: string,
    args: ServiceArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:k8s:Service", name, {}, opts);

    this.service = new k8s.core.v1.Service(
      name,
      {
        metadata: {
          namespace: args.ns.metadata.name,
          labels: args.labels,
        },
        spec: {
          type: args.type,
          selector: args.labels,
          ports: args.ports,
        },
      },
      { provider: opts?.provider }
    );

    this.registerOutputs({
      service: this.service,
    });
  }
}
