from pulumi import ComponentResource, ResourceOptions, Output
from pulumi_gcp import container
from pulumi_gcp.config import project, zone
import pulumi_kubernetes as k8s

class GkeClusterArgs:

    def __init__(self,
                 master_version=None,
                 node_count=None,
                 node_machine_type=None,
                 ):

        self.master_version = master_version
        self.node_count = node_count
        self.node_machine_type = node_machine_type


class GkeCluster(ComponentResource):

    def __init__(self,
                 name: str,
                 args: GkeClusterArgs,
                 opts: ResourceOptions = None):

        super().__init__('custom:kubernetes:GkeCluster', name, {}, opts)

        latest_gke_version = container.get_engine_versions().latest_master_version
        master_version = args.master_version or latest_gke_version
        node_count = args.node_count or 3
        node_machine_type = args.node_machine_type or "n1-standard-1"

        k8s_cluster = container.Cluster(f"{name}-cluster", 
                                        initial_node_count=1,
                                        remove_default_node_pool=True,
                                        min_master_version=master_version,
                                        opts=ResourceOptions(parent=self))

        node_pool = container.NodePool(f"{name}-primary-node-pool", 
                                        cluster=k8s_cluster.name,
                                        initial_node_count=node_count,
                                        location=k8s_cluster.location,
                                        node_config=container.NodePoolNodeConfigArgs(
                                          preemptible=True,
                                          machine_type=node_machine_type,
                                          oauth_scopes=[
                                            "https://www.googleapis.com/auth/compute",
                                            "https://www.googleapis.com/auth/devstorage.read_only",
                                            "https://www.googleapis.com/auth/logging.write",
                                            "https://www.googleapis.com/auth/monitoring",
                                          ]
                                        ),
                                        version=master_version,
                                        management=container.NodePoolManagementArgs(
                                          auto_repair=True
                                        ),
                                        opts=ResourceOptions(parent=self, depends_on=[k8s_cluster]))

        # Manufacture a GKE-style Kubeconfig. Note that this is slightly "different" because of the way GKE requires
        # gcloud to be in the picture for cluster authentication (rather than using the client cert/key directly).
        k8s_info = Output.all(k8s_cluster.name, k8s_cluster.endpoint, k8s_cluster.master_auth)
        k8s_config = k8s_info.apply(
            lambda info: """apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: {0}
    server: https://{1}
  name: {2}
contexts:
- context:
    cluster: {2}
    user: {2}
  name: {2}
current-context: {2}
kind: Config
preferences: {{}}
users:
- name: {2}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true
        """.format(info[2]['cluster_ca_certificate'], info[1], '{0}_{1}_{2}'.format(project, zone, info[0])))

        self.kubeconfig = Output.secret(k8s_config)

        self.k8s_provider = k8s.Provider('k8s-provider', 
                                         kubeconfig=k8s_config,
                                         delete_unreachable=True, 
                                         opts=ResourceOptions(depends_on=[node_pool]))

        self.register_outputs({})


