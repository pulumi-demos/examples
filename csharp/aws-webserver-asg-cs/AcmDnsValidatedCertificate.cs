using Pulumi;
using Pulumi.Aws.Acm;
using Pulumi.Aws.Route53;


public class AcmDnsValidatedCertificateArgs : ResourceArgs
{
    [Input("ZoneId")]
    public Input<string>? ZoneId { get; init; }

    [Input("Subdomain")]
    public Input<string>? Subdomain { get; init; }
}

public class AcmDnsValidatedCertificate : ComponentResource
{
    [Output]
    public Output<string> certificateArn { get; set; }

    public AcmDnsValidatedCertificate(string name, AcmDnsValidatedCertificateArgs args, ComponentResourceOptions? options = null)
        : base("custom:x:AcmDnsValidatedCertificate", name, options)
    {
        var cert = new Certificate("default", new()
        {
            DomainName = args.Subdomain,
            ValidationMethod = "DNS"
        }, new()
        {
            Parent = this,
        });


        var certValidation = new Record("certValidation", new()
        {
            Name = cert.DomainValidationOptions.Apply(options => options[0].ResourceRecordName!),
            Records = { cert.DomainValidationOptions.Apply(options => options[0].ResourceRecordValue!), },
            Ttl = 60,
            Type = cert.DomainValidationOptions.Apply(options => options[0].ResourceRecordType!),
            ZoneId = args.ZoneId!,
        }, new()
        {
            Parent = this,
        });

        var certCertificateValidation = new CertificateValidation("cert", new()
        {
            CertificateArn = cert.Arn,
            ValidationRecordFqdns = { certValidation.Fqdn, },
        }, new()
        {
            Parent = this,
        });

        certificateArn = certCertificateValidation.CertificateArn;

        this.RegisterOutputs();
    }
}