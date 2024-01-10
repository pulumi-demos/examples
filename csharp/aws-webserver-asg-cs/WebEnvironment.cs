using System;
using System.Text;
using Pulumi;
using Pulumi.Tls;
using LB = Pulumi.Aws.LB;
using Ec2 = Pulumi.Aws.Ec2;
using AutoScaling = Pulumi.Aws.AutoScaling;
using Pulumi.Aws.Route53;
using Pulumi.Aws.Route53.Inputs;
using Pulumi.Aws.AutoScaling.Inputs;
using System.Linq;

public class WebEnvironmentArgs : ResourceArgs
{

    [Input("ImageId")]
    public Input<string>? ImageId { get; set; }

    [Input("InstanceCount")]
    public int InstanceCount { get; set; }

    [Input("VpcId")]
    public Input<string>? VpcId { get; set; }

    [Input("VpcCidrBlock")]
    public Input<string>? VpcCidrBlock { get; set; }

    [Input("BaseTags")]
    public InputMap<string>? BaseTags { get; set; }

    [Input("PublicSubnetIds")]
    public InputList<string>? PublicSubnetIds { get; set; }

    [Input("PrivateSubnetIds")]
    public InputList<string>? PrivateSubnetIds { get; set; }

    [Input("Certificate")]
    public Input<string>? CertificateArn { get; internal set; }

    [Input("ZoneId")]
    public Input<string>? ZoneId { get; init; }

    [Input("Subdomain")]
    public Input<string>? Subdomain { get; init; }

    [Input("InstanceSize")]
    public Input<string>? InstanceSize { get; init; }
}

public class WebEnvironment : ComponentResource
{

    public WebEnvironment(string name, WebEnvironmentArgs args, ComponentResourceOptions? options = null)
        : base("custom:x:WebEnvironment", name, options)
    {

        var albSg = new Ec2.SecurityGroup($"{name}-alb-sg", new Ec2.SecurityGroupArgs
        {
            VpcId = args.VpcId,
            Ingress = new[]{
                new Ec2.Inputs.SecurityGroupIngressArgs { Protocol = "TCP", FromPort = 443, ToPort = 443, CidrBlocks = new []{ "0.0.0.0/0"}},
                new Ec2.Inputs.SecurityGroupIngressArgs { Protocol = "TCP", FromPort = 80, ToPort = 80, CidrBlocks = new []{"0.0.0.0/0"}},
            },
            Egress = new[]{
                    new Ec2.Inputs.SecurityGroupEgressArgs { Protocol = "-1", FromPort = 0, ToPort = 0,  CidrBlocks = new []{ "0.0.0.0/0" }}
            }
        }, new CustomResourceOptions
        {
            Parent = this
        });

        var instanceSg = new Ec2.SecurityGroup($"{name}-instance-sg", new Ec2.SecurityGroupArgs
        {
            VpcId = args.VpcId,
            Ingress = new[]{
                new Ec2.Inputs.SecurityGroupIngressArgs { Protocol = "TCP", FromPort = 22, ToPort = 22, CidrBlocks = new []{ args.VpcCidrBlock! }},
                new Ec2.Inputs.SecurityGroupIngressArgs { Protocol = "TCP", FromPort = 80, ToPort = 80, SecurityGroups = albSg.Id},
            },
            Egress = new[]{
                    new Ec2.Inputs.SecurityGroupEgressArgs { Protocol = "-1", FromPort = 0, ToPort = 0,  CidrBlocks = new []{ "0.0.0.0/0" }}
            }
        }, new CustomResourceOptions
        {
            Parent = this
        });

        var sshKeyMaterial = new PrivateKey(name, new PrivateKeyArgs
        {
            Algorithm = "RSA",
        }, new CustomResourceOptions
        {
            Parent = this
        });

        var sshKey = new Ec2.KeyPair(name, new Ec2.KeyPairArgs
        {
            PublicKey = sshKeyMaterial.PublicKeyOpenssh,
        }, new CustomResourceOptions
        {
            Parent = sshKeyMaterial,
        });

        var launchTemplate = new Ec2.LaunchTemplate($"{name}-lauch-config", new Ec2.LaunchTemplateArgs
        {
            NamePrefix = "web",
            InstanceType = args.InstanceSize,
            ImageId = args.ImageId,
            KeyName = sshKey.KeyName,
            VpcSecurityGroupIds = new[] { instanceSg.Id },
            Tags = args.BaseTags ?? new InputMap<string>(),
            UserData = Convert.ToBase64String(Encoding.UTF8.GetBytes(@$"
#!/bin/bash
sudo yum update -y
sudo amazon-linux-extras install nginx1 -y 
sudo systemctl enable nginx
sudo systemctl start nginx    
            "))
        }, new CustomResourceOptions
        {
            Parent = this
        });

        var asg = new AutoScaling.Group($"{name}-asg", new()
        {
            VpcZoneIdentifiers = args.PrivateSubnetIds!,
            DesiredCapacity = args.InstanceCount,
            MaxSize = args.InstanceCount,
            MinSize = 1,
            LaunchTemplate = new GroupLaunchTemplateArgs
            {
                Id = launchTemplate.Id,
                Version = "$Latest",
            },
            Tags = args.BaseTags.Apply(x => x.Select(t => new GroupTagArgs { Key = t.Key, Value = t.Value, PropagateAtLaunch = true })),
        }, new CustomResourceOptions
        {
            Parent = launchTemplate,
        });

        var alb = new LB.LoadBalancer($"{name}-alb", new LB.LoadBalancerArgs
        {
            Internal = false,
            LoadBalancerType = "application",
            SecurityGroups = new[] { albSg.Id },
            Subnets = args.PublicSubnetIds.Apply(sid => sid),

        }, new CustomResourceOptions
        {
            Parent = this,
        });

        var tg = new LB.TargetGroup($"{name}-tg", new LB.TargetGroupArgs
        {
            TargetType = "instance",
            Port = 80,
            Protocol = "HTTP",
            VpcId = args.VpcId,
        }, new CustomResourceOptions
        {
            Parent = this,
        });

        var listener = new LB.Listener($"{name}-frontend-https", new LB.ListenerArgs
        {

            LoadBalancerArn = alb.Arn,
            Port = 443,
            Protocol = "HTTPS",
            CertificateArn = args.CertificateArn,
            DefaultActions = new[] {
                new LB.Inputs.ListenerDefaultActionArgs {
                    Type = "forward",
                    TargetGroupArn = tg.Arn,
                }
            },
        }, new CustomResourceOptions
        {
            Parent = alb,
        });

        var redirectListener = new LB.Listener($"{name}-frontend-https-redirect", new()
        {
            LoadBalancerArn = alb.Arn,
            DefaultActions =
            {
                new LB.Inputs.ListenerDefaultActionArgs
                {
                    Type = "redirect",
                    Redirect = new LB.Inputs.ListenerDefaultActionRedirectArgs
                    {
                        Protocol = "HTTPS",
                        Port = "443",
                        StatusCode = "HTTP_301"
                    }
                }
            },
            Port = 80,
            Protocol = "HTTP"
        }, new CustomResourceOptions
        {
            Parent = alb,
        });

        var attachment = new AutoScaling.Attachment($"{name}-alb-attachment", new()
        {
            AutoscalingGroupName = asg.Name,
            LbTargetGroupArn = tg.Arn,
        }, new CustomResourceOptions
        {
            Parent = asg
        });


        if (args.ZoneId != null && args.Subdomain != null)
        {
            var arecord = new Record("alias", new()
            {
                Name = args.Subdomain,
                ZoneId = args.ZoneId,
                Type = "A",
                Aliases = new () {
                    new RecordAliasArgs() {
                        ZoneId = alb.ZoneId,
                        Name = alb.DnsName,
                        EvaluateTargetHealth = true,
                    }
                },
            }, new CustomResourceOptions
            {
                Parent = this
            });
        }

        this.RegisterOutputs();
    }
}