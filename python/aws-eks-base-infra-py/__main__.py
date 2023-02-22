# Pulumi SDKs
import pulumi
from pulumi_aws import eks

# components
from aws_network import Vpc, VpcArgs 

# local python modules
import iam
import utils

# Get stack-specific config
config = pulumi.Config()
service_name = config.get("service_name") or pulumi.get_project()
desired_size = config.get_int("desired_count") or 2
max_size = config.get_int("max_count") or 2
min_size = config.get_int("min_count") or 1

## VPC and related resources
vpc =Vpc(f'{service_name}-net', VpcArgs()) 

## EKS Cluster
eks_cluster = eks.Cluster(
    f'{service_name}-cluster',
    role_arn=iam.eks_role.arn,
    tags={
        'Name': 'pulumi-eks-cluster',
    },
    vpc_config=eks.ClusterVpcConfigArgs(
        public_access_cidrs=['0.0.0.0/0'],
        security_group_ids=[vpc.fe_security_group.id],
        subnet_ids=vpc.subnet_ids,
    ),
)

eks_node_group = eks.NodeGroup(
    f'{service_name}-nodegroup',
    cluster_name=eks_cluster.name,
    node_group_name='pulumi-eks-nodegroup',
    node_role_arn=iam.ec2_role.arn,
    subnet_ids=vpc.subnet_ids,
    tags={
        'Name': 'pulumi-cluster-nodeGroup',
    },
    scaling_config=eks.NodeGroupScalingConfigArgs(
        desired_size=desired_size,
        max_size=max_size,
        min_size=min_size,
)

pulumi.export('kubeconfig', pulumi.Output.secret(utils.generate_kube_config(eks_cluster)))
