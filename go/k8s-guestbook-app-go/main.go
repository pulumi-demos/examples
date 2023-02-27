package main

import (
	"fmt"

	servicedeployment "github.com/pulumi-demos/examples/multilanguage-packages/pulumi-k8s-servicedeployment/sdk/go/k8s"
	"github.com/pulumi/pulumi-aws/sdk/v5/go/aws/s3"
	"github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes"
	corev1 "github.com/pulumi/pulumi-kubernetes/sdk/v3/go/kubernetes/core/v1"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "")
		eksProject := cfg.Require("eksProject")
		baseInfraStack, err := pulumi.NewStackReference(ctx, "baseK8sStack", &pulumi.StackReferenceArgs{
			Name: pulumi.String(fmt.Sprintf("%v/%v/%v", ctx.Organization(), eksProject, ctx.Stack())),
		})
		if err != nil {
			return err
		}
		kubeconfig := baseInfraStack.GetStringOutput(pulumi.String("kubeconfig"))
		k8SProvider, err := kubernetes.NewProvider(ctx, "k8sProvider", &kubernetes.ProviderArgs{
			Kubeconfig:        kubeconfig,
			DeleteUnreachable: pulumi.Bool(true),
		})
		if err != nil {
			return err
		}
		guestbookNamespace, err := corev1.NewNamespace(ctx, "guestbook-go-ns", nil, pulumi.Provider(k8SProvider))
		if err != nil {
			return err
		}
		_, err = servicedeployment.NewServiceDeployment(ctx, "redis-leader", &servicedeployment.ServiceDeploymentArgs{
			Namespace: guestbookNamespace.Metadata.Elem().Name(),
			Image: pulumi.String("redis"),
			Ports: pulumi.Float64Array{
				pulumi.Float64(6379),
			},
		}, pulumi.Provider(k8SProvider))
		if err != nil {
			return err
		}
		_, err = servicedeployment.NewServiceDeployment(ctx, "redis-replica", &servicedeployment.ServiceDeploymentArgs{
			Namespace: guestbookNamespace.Metadata.Elem().Name(),
			Image: pulumi.String("pulumi/guestbook-redis-replica"),
			Ports: pulumi.Float64Array{
				pulumi.Float64(6379),
			},
		}, pulumi.Provider(k8SProvider))
		if err != nil {
			return err
		}
		frontend, err := servicedeployment.NewServiceDeployment(ctx, "frontend", &servicedeployment.ServiceDeploymentArgs{
			Namespace: guestbookNamespace.Metadata.Elem().Name(),
			Image: pulumi.String("pulumi/guestbook-php-redis"),
			Ports: pulumi.Float64Array{
				pulumi.Float64(80),
			},
			Replicas:    pulumi.Float64(3),
			ServiceType: pulumi.String("LoadBalancer"),
		}, pulumi.Provider(k8SProvider))
		if err != nil {
			return err
		}
		bucket, err := s3.NewBucket(ctx, "bucket", &s3.BucketArgs{
			Acl: pulumi.String("public-read"),
		})
		if err != nil {
			return err
		}
		ctx.Export("frontEndUrl", frontend.FrontEndIp.ApplyT(func(frontEndIp string) (string, error) {
			return fmt.Sprintf("http://%v", frontEndIp), nil
		}).(pulumi.StringOutput))

		ctx.Export("bucketId", bucket.ID())
		return nil
	})
}
