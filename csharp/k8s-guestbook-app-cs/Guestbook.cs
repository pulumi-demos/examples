using Pulumi;
using K8s = Pulumi.Kubernetes;
using Pulumi.K8sServiceDeployment;

class Guestbook : Stack
{
    public Guestbook()
    {
        var config = new Config();
        var org = config.Require("org");
        var k8sStackProject = config.Require("k8sProject");
        var currentStack = Deployment.Instance.StackName;
        var k8sStackName = $"{org}/{k8sStackProject}/{currentStack}";
        var k8sStackRef = new StackReference(k8sStackName);

        var kubeConfig = Output.Format($"{k8sStackRef.RequireOutput("kubeconfig").Apply(v => v.ToString())}"); 
        var provider = new K8s.Provider("k8s", new K8s.ProviderArgs {KubeConfig = kubeConfig, DeleteUnreachable = true});
        var options = new ComponentResourceOptions { Provider = provider };

        var ns = new K8s.Core.V1.Namespace("guestbook-cs-ns", new K8s.Types.Inputs.Core.V1.NamespaceArgs{}, new CustomResourceOptions{Provider=provider});
        var ns_name = ns.Metadata.Apply(x => x.Name);

        var redisLeader = new ServiceDeployment("redis-leader", new ServiceDeploymentArgs
        {
            Namespace = ns_name,
            Image = "redis",
            Ports = {6379}
        }, options);

        var redisReplica = new ServiceDeployment("redis-replica", new ServiceDeploymentArgs
        {
            Namespace = ns_name,
            Image = "pulumi/guestbook-redis-replica",
            Ports = {6379}
        }, options);

        var frontend = new ServiceDeployment("frontend", new ServiceDeploymentArgs
        {
            Namespace = ns_name,
            Replicas = 3,
            Image = "pulumi/guestbook-php-redis",
            Ports = {80},
            ServiceType = "LoadBalancer",
        }, options);

        this.FrontendIp = frontend.FrontEndIp.Apply(ip => "http://"+ip);
    }

    [Output] public Output<string> FrontendIp { get; set; }
}
