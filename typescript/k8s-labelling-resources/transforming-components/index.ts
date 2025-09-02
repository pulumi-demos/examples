import { EKSResources } from "./EKSResources";
import * as pulumi from "@pulumi/pulumi";

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
          return {
            props,
            opts: args.opts,
          };
        }
        return undefined;
      },
    ],
  }
);

export const kubeconfig = eksResources.kubeconfig;
export const serviceIp = eksResources.serviceIp;
