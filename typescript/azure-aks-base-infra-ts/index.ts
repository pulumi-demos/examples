// Pulumi-published packages
import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-native/resources";
import * as k8s from "@pulumi/kubernetes";

// Custom component resources
import {Cluster, ClusterArgs} from "./cluster";

// Typescript modules
import * as config from "./config";

const baseName = `aks-${pulumi.getStack()}`
const resourceGroup = new resources.ResourceGroup(baseName);

const cluster = new Cluster(baseName, {
    adminUserName: config.adminUserName,
    k8sVersion: config.k8sVersion,
    nodeCount: config.nodeCount,
    nodeSize: config.nodeSize,
    resourceGroupName: resourceGroup.name,
})

export const clusterName = cluster.clusterName;

export const kubeconfig = cluster.kubeconfig;

// Create a canary deployment to test that this cluster works.
const k8sProvider = new k8s.Provider("k8sprovider", {
    kubeconfig: kubeconfig
})

const name = `canary-${pulumi.getStack()}`;
const canaryLabels = { app: `canary` };
const canary = new k8s.apps.v1.Deployment(name, {
    spec: {
        selector: { matchLabels: canaryLabels },
        replicas: 1,
        template: {
            metadata: { labels: canaryLabels },
            spec: { containers: [{ name, image: "nginx" }] },
        },
    },
}, { provider: k8sProvider });
