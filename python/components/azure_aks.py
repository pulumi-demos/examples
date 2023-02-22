from pulumi import ComponentResource, ResourceOptions, Output
from pulumi_azure_native import containerservice
import pulumi_azuread as azuread
import pulumi_kubernetes as k8s
import base64
import time

class AksClusterArgs:

    def __init__(self,
                 rg_name=None,
                 cluster_node_count=None,
                 cluster_node_size=None,
                 admin_username=None,
                 ssh_public_key=None,
                 ):

        self.rg_name = rg_name 
        self.cluster_node_count = cluster_node_count
        self.cluster_node_size = cluster_node_size
        self.admin_username = admin_username
        self.ssh_public_key = ssh_public_key


class AksCluster(ComponentResource):

    def __init__(self,
                 name: str,
                 args: AksClusterArgs,
                 opts: ResourceOptions = None):

        super().__init__('custom:kubernetes:AksCluster', name, {}, opts)
        opts.parent=self

        rg_name = args.rg_name
        cluster_node_count = args.cluster_node_count
        cluster_node_size = args.cluster_node_size
        admin_username = args.admin_username
        ssh_public_key = args.ssh_public_key

        
        # Active Directory 
        ad_app_name = f"{name}-aks-app"
        current = azuread.get_client_config()
        ad_app = azuread.Application(ad_app_name,
            display_name=ad_app_name,
            owners=[current.object_id],
            opts=opts)

        ad_sp = azuread.ServicePrincipal(f"{name}-aks-sp",
            application_id=ad_app.application_id,
            app_role_assignment_required=False,
            owners=[current.object_id],
            opts=opts)

        ad_sp_password = azuread.ServicePrincipalPassword(f"{name}-aks-sp-pwd",
            service_principal_id=ad_sp.id,
            end_date='2099-01-01T00:00:00Z',
            opts=opts)

        # K8s cluster
        k8s_cluster = containerservice.ManagedCluster(f"{name}-aks-cluster",
            resource_group_name=rg_name,
            agent_pool_profiles=[{
                'count': cluster_node_count,
                'max_pods': 110,
                'mode': 'System',
                'name': 'agentpool',
                'node_labels': {},
                'os_disk_size_gb': 30,
                'os_type': 'Linux',
                'type': 'VirtualMachineScaleSets',
                'vm_size': cluster_node_size,
            }],
            dns_prefix=rg_name,
            enable_rbac=True,
            linux_profile={
                'admin_username': admin_username,
                'ssh': {
                    'publicKeys': [{
                        'keyData': ssh_public_key,
                    }],
                },
            },
            node_resource_group=f"{name}-node-group",
            service_principal_profile=Output.all(app_id=ad_app.application_id, pwd=ad_sp_password.value).apply(lambda args: sp_profile(args)),
            opts=opts)

        creds = containerservice.list_managed_cluster_user_credentials_output(
            resource_group_name=rg_name,
            resource_name=k8s_cluster.name)

        self.kubeconfig = creds.kubeconfigs[0].value.apply(
            lambda enc: base64.b64decode(enc).decode())

        self.k8s_provider = k8s.Provider('k8s-provider', kubeconfig=self.kubeconfig, delete_unreachable=True)

        self.register_outputs({})


def sp_profile(args):
    # Azure AD will sometimes return service principal info, 
    # but the SP hasn't propagated and so Azure throws an error 
    # about not finding the SP when creating the AKS cluster. 
    # So take a small nap to give time for the propagation.
    time.sleep(30) 
    return({'client_id': args["app_id"],'secret': args["pwd"]})