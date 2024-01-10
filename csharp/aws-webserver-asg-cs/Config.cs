
using System.Collections.Immutable;
using System.Linq;
using Pulumi;
using Pulumi.Aws.Ec2;

public static class Helpers {

    public static Output<string> AmazonAmiId { 
        get {
            return GetAmi.Invoke(new GetAmiInvokeArgs {
                Owners = new []{ "137112412989" },
                MostRecent = true,
                Filters = new InputList<Pulumi.Aws.Ec2.Inputs.GetAmiFilterInputArgs> {
                    new Pulumi.Aws.Ec2.Inputs.GetAmiFilterInputArgs { 
                        Name = "name",
                        Values = new [] { "amzn2-ami-minimal-hvm-*-x86_64-ebs" }
                    }
                }
            }).Apply(it => it.Id);
        }
    }

    public static Output<T[]> AsArray<T>(this Output<object> input)
    {
        return input.Apply(i => ((ImmutableArray<object>)i).Select(o => (T)o).ToArray());
    }
}