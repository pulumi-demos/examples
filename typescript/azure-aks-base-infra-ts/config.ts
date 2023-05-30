// Copyright 2016-2021, Pulumi Corporation.  All rights reserved.

import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as random from "@pulumi/random";
import * as tls from "@pulumi/tls";

const config = new pulumi.Config();
const azConfig = new pulumi.Config("azure-native")


export var k8sVersion = config.get("k8sVersion") || azure.containerservice.getKubernetesServiceVersions({
        location: azConfig.require("location")
    }).then(current => current.latestVersion)

export const password = config.get("password") || new random.RandomPassword("pw", {
    length: 20,
    special: true,
}).result;

export const generatedKeyPair = new tls.PrivateKey("ssh-key", {
    algorithm: "RSA",
    rsaBits: 4096,
});

export const adminUserName = config.get("adminUserName") || "testuser";

export const sshPublicKey = config.get("sshPublicKey") || generatedKeyPair.publicKeyOpenssh;

export const nodeCount = config.getNumber("nodeCount") || 2;

export const nodeSize = config.get("nodeSize") || "Standard_D2_v2";
