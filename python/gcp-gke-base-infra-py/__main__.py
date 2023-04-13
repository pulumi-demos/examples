"""A Google Cloud Python Pulumi program"""

# Pulumi-provided packages
import pulumi
from pulumi_kubernetes.apps.v1 import Deployment, DeploymentSpecArgs
from pulumi_kubernetes.core.v1 import ContainerArgs, EnvVarArgs, PodSpecArgs, PodTemplateSpecArgs
from pulumi_kubernetes.meta.v1 import LabelSelectorArgs, ObjectMetaArgs
import pulumi_kubernetes as k8s

# Component Resource
from gke_cluster import GkeCluster, GkeClusterArgs

# Stack Config
config = pulumi.Config()
master_version = config.get("master_version") 
node_machine_type = config.get("node_machine_type")
node_count = config.get("node_count") or 3

base_name = f"gkebase-py-{pulumi.get_stack()}"

# Create a GKE cluster using the component resource 
k8s_cluster = GkeCluster(base_name, GkeClusterArgs(
    master_version=master_version,
    node_count=node_count,
    node_machine_type=node_machine_type
))

# Create a canary deployment to test that the cluster works.
canary_labels = { "app": f"canary-{base_name}"}
canary = Deployment("canary", 
    spec=DeploymentSpecArgs(
      selector=LabelSelectorArgs(match_labels=canary_labels),
      replicas=1,
      template=PodTemplateSpecArgs(
        metadata=ObjectMetaArgs(labels=canary_labels),
        spec=PodSpecArgs(containers=[ContainerArgs(
          name="nginx", 
          image="nginx",
          env=[EnvVarArgs(
            name="DEPLOYMENT_SECRET",
            value=config.get_secret("deployment_secret")
          )]
        )])
      )
    ),
    opts=pulumi.ResourceOptions(provider=k8s_cluster.k8s_provider)
)

pulumi.export("kubeconfig", k8s_cluster.kubeconfig)



