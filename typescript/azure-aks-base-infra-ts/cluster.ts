import * as containerservice from "@pulumi/azure-native/containerservice";
import * as azuread from "@pulumi/azuread";
import * as pulumi from "@pulumi/pulumi";
import * as tls from "@pulumi/tls";


export interface ClusterArgs {
    adminUserName: pulumi.Input<string>;
    k8sVersion: pulumi.Input<string>;
    nodeCount: number;
    nodeSize: string
    resourceGroupName: pulumi.Input<string>;
}

export class Cluster extends pulumi.ComponentResource {
    public readonly clusterName: pulumi.Output<string>;
    public readonly kubeconfig: pulumi.Output<string>;

    constructor(name: string, args: ClusterArgs, opts?: pulumi.ComponentResourceOptions) {

        super("custom:resource:AzureCluster", name, args, opts);
    
        const appName = `${name}-app`
        const currentClient = azuread.getClientConfig()
        const clientOwners = currentClient.then(current => [current.objectId])
        const adApp = new azuread.Application(appName, {
            displayName: appName,
            owners: clientOwners,
        }, {parent: this});

        const adSp = new azuread.ServicePrincipal(`${name}-sp`, {
            applicationId: adApp.applicationId,
            appRoleAssignmentRequired: false,
        }, {parent: this});

        const adSpPassword = new azuread.ServicePrincipalPassword(`${name}-sp-pwd`, {
            servicePrincipalId: adSp.id,
        }, {parent: this});

        const generatedKeyPair = new tls.PrivateKey("ssh-key", {
            algorithm: "RSA",
            rsaBits: 4096,
        }, {parent: this});
        const sshPublicKey = generatedKeyPair.publicKeyOpenssh;

        const k8sCluster = new containerservice.ManagedCluster(`${name}-cluster`, {
            resourceGroupName: args.resourceGroupName,
            agentPoolProfiles: [{
                count: args.nodeCount,
                maxPods: 110,
                mode: "System",
                name: "agentpool",
                nodeLabels: {},
                osDiskSizeGB: 30,
                osType: "Linux",
                type: "VirtualMachineScaleSets",
                vmSize: args.nodeSize,
            }],
            dnsPrefix: args.resourceGroupName,
            enableRBAC: true,
            kubernetesVersion: args.k8sVersion,
            linuxProfile: {
                adminUsername: args.adminUserName,
                ssh: {
                    publicKeys: [{
                        keyData: sshPublicKey,
                    }],
                },
            },
            nodeResourceGroup: `${name}-cluster-node-rg`,
            servicePrincipalProfile: {
                clientId: adApp.applicationId,
                secret: adSpPassword.value,
            },
        }, {parent: this});

        const creds = containerservice.listManagedClusterUserCredentialsOutput({
            resourceGroupName: args.resourceGroupName,
            resourceName: k8sCluster.name,
        }, {parent: this});

        this.clusterName = k8sCluster.name
        this.kubeconfig =
            pulumi.secret(creds.kubeconfigs[0].value
                .apply(enc => Buffer.from(enc, "base64").toString()));
    }
};
