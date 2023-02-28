import pulumi
from pulumi.resource import ResourceOptions
import pulumi_kubernetes as k8s
from pulumi_k8s_servicedeployment import ServiceDeployment, ServiceDeploymentArgs

config = pulumi.Config()
org = pulumi.get_organization()
k8s_stack_project = config.require("k8sProject")
current_stack = pulumi.get_stack()
project = pulumi.get_project()
k8s_stack_name = f"{org}/{k8s_stack_project}/{current_stack}"
k8s_stack_ref = pulumi.StackReference(k8s_stack_name)

kubeconfig = k8s_stack_ref.require_output("kubeconfig") 
k8s_provider = k8s.Provider('k8s-provider', kubeconfig=kubeconfig, delete_unreachable=True)

guestbook_ns = k8s.core.v1.Namespace("guestbook-py-ns", 
    ResourceOptions(provider=k8s_provider))

guestbook_ns_name = guestbook_ns.metadata.name

leader = ServiceDeployment("redis-leader", ServiceDeploymentArgs(
    namespace=guestbook_ns_name,
    image="redis",
    ports=[6379]),
    ResourceOptions(provider=k8s_provider))

replica = ServiceDeployment("redis-replica", ServiceDeploymentArgs(
    namespace=guestbook_ns_name,
    image="pulumi/guestbook-redis-replica",
    ports=[6379]),
    ResourceOptions(provider=k8s_provider))

frontend = ServiceDeployment("frontend", ServiceDeploymentArgs(
    namespace=guestbook_ns_name,
    image="pulumi/guestbook-php-redis",
    replicas=3,
    ports=[80],
    service_type="LoadBalancer"),
    ResourceOptions(provider=k8s_provider))

front_end_url = pulumi.Output.concat("http://", frontend.front_end_ip)
pulumi.export("front_end_url", front_end_url)

