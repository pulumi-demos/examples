// Copyright 2016-2021, Pulumi Corporation.  All rights reserved.
import * as pulumi from "@pulumi/pulumi";

import * as k8s from "@pulumi/kubernetes";

import * as cluster from "./cluster";

export let clusterName = cluster.k8sCluster.name;

export let kubeconfig = pulumi.secret(cluster.kubeconfig);

// Create a canary deployment to test that this cluster works.
const name = `aksbase-${pulumi.getStack()}`;
const canaryLabels = { app: `canary` };
const canary = new k8s.apps.v1.Deployment(`canary-${name}`, {
    spec: {
        selector: { matchLabels: canaryLabels },
        replicas: 1,
        template: {
            metadata: { labels: canaryLabels },
            spec: { containers: [{ name, image: "nginx" }] },
        },
    },
}, { provider: cluster.k8sProvider });
