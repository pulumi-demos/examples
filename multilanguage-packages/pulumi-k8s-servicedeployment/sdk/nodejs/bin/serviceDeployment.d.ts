import * as pulumi from "@pulumi/pulumi";
export declare class ServiceDeployment extends pulumi.ComponentResource {
    /**
     * Returns true if the given object is an instance of ServiceDeployment.  This is designed to work even
     * when multiple copies of the Pulumi SDK have been loaded into the same process.
     */
    static isInstance(obj: any): obj is ServiceDeployment;
    /**
     * The front end IP
     */
    readonly frontEndIp: pulumi.Output<string>;
    /**
     * Create a ServiceDeployment resource with the given unique name, arguments, and options.
     *
     * @param name The _unique_ name of the resource.
     * @param args The arguments to use to populate this resource's properties.
     * @param opts A bag of options that control this resource's behavior.
     */
    constructor(name: string, args: ServiceDeploymentArgs, opts?: pulumi.ComponentResourceOptions);
}
/**
 * The set of arguments for constructing a ServiceDeployment resource.
 */
export interface ServiceDeploymentArgs {
    /**
     * Name of the image to deploy.
     */
    image: pulumi.Input<string>;
    /**
     * Namespace in which to push the deployment and service.
     */
    namespace?: pulumi.Input<string>;
    /**
     * Ports for service to listen on.
     */
    ports: pulumi.Input<pulumi.Input<number>[]>;
    /**
     * Number of replicas of the service to deploy.
     */
    replicas?: pulumi.Input<number>;
    /**
     * Service Type for K8s service. E.g. "LoadBalancer" or "ClusterIP"
     */
    serviceType?: pulumi.Input<string>;
}
