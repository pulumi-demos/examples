"""Webhook ingestion ComponentResource.

Encapsulates the upstream pipeline that gets data from webhooks
into S3: Lambda Function URL -> Amazon Data Firehose -> S3.

The component is source-agnostic: callers provide their own Lambda code,
handler, and environment variables (e.g., a webhook secret). The component
adds FIREHOSE_STREAM_NAME automatically.
"""

import json
from dataclasses import dataclass

import pulumi
import pulumi_aws as aws


@dataclass
class WebhookIngestionArgs:
    """Arguments for the WebhookIngestion component."""

    bucket_arn: pulumi.Input[str]
    bucket_name: pulumi.Input[str]
    lambda_code: pulumi.Archive
    lambda_handler: str
    lambda_environment: dict[str, pulumi.Input[str]]
    s3_prefix: str = "github-webhooks"


class WebhookIngestion(pulumi.ComponentResource):
    """Reusable component for webhook ingestion via Lambda + Firehose.

    Creates:
    - A Lambda function with caller-provided code and environment
    - A Lambda Function URL (public endpoint for webhook sources)
    - An Amazon Data Firehose delivery stream that buffers and writes to S3

    Outputs:
    - function_url: The public URL to use as the webhook endpoint
    """

    function_url: pulumi.Output[str]

    def __init__(
        self,
        name: str,
        args: WebhookIngestionArgs,
        opts: pulumi.ResourceOptions | None = None,
    ):
        super().__init__("snowpipe:webhook:WebhookIngestion", name, {}, opts)

        # --- Firehose delivery stream ---
        # IAM role for Firehose to write to S3
        firehose_role = aws.iam.Role(
            f"{name}-firehose-role",
            assume_role_policy=json.dumps({
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": "sts:AssumeRole",
                    "Principal": {"Service": "firehose.amazonaws.com"},
                }],
            }),
            opts=pulumi.ResourceOptions(parent=self),
        )

        aws.iam.RolePolicy(
            f"{name}-firehose-s3-policy",
            role=firehose_role.id,
            policy=args.bucket_arn.apply(
                lambda arn: json.dumps({
                    "Version": "2012-10-17",
                    "Statement": [{
                        "Effect": "Allow",
                        "Action": [
                            "s3:AbortMultipartUpload",
                            "s3:GetBucketLocation",
                            "s3:GetObject",
                            "s3:ListBucket",
                            "s3:ListBucketMultipartUploads",
                            "s3:PutObject",
                        ],
                        "Resource": [arn, f"{arn}/*"],
                    }],
                })
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        stream = aws.kinesis.FirehoseDeliveryStream(
            f"{name}-firehose",
            destination="extended_s3",
            extended_s3_configuration=aws.kinesis.FirehoseDeliveryStreamExtendedS3ConfigurationArgs(
                role_arn=firehose_role.arn,
                bucket_arn=args.bucket_arn,
                prefix=f"{args.s3_prefix}/!{{timestamp:yyyy}}/!{{timestamp:MM}}/!{{timestamp:dd}}/!{{timestamp:HH}}/",
                error_output_prefix=f"{args.s3_prefix}-errors/",
                buffering_interval=60,
                buffering_size=100,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        # --- Lambda function ---
        # IAM role for Lambda
        lambda_role = aws.iam.Role(
            f"{name}-lambda-role",
            assume_role_policy=json.dumps({
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Action": "sts:AssumeRole",
                    "Principal": {"Service": "lambda.amazonaws.com"},
                }],
            }),
            opts=pulumi.ResourceOptions(parent=self),
        )

        aws.iam.RolePolicyAttachment(
            f"{name}-lambda-basic-execution",
            role=lambda_role.name,
            policy_arn="arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            opts=pulumi.ResourceOptions(parent=self),
        )

        aws.iam.RolePolicy(
            f"{name}-lambda-firehose-policy",
            role=lambda_role.id,
            policy=stream.arn.apply(
                lambda arn: json.dumps({
                    "Version": "2012-10-17",
                    "Statement": [{
                        "Effect": "Allow",
                        "Action": ["firehose:PutRecord"],
                        "Resource": [arn],
                    }],
                })
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        env_vars = {**args.lambda_environment, "FIREHOSE_STREAM_NAME": stream.name}

        fn = aws.lambda_.Function(
            f"{name}-handler",
            runtime="python3.11",
            handler=args.lambda_handler,
            role=lambda_role.arn,
            timeout=30,
            code=args.lambda_code,
            environment=aws.lambda_.FunctionEnvironmentArgs(
                variables=env_vars,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        fn_url = aws.lambda_.FunctionUrl(
            f"{name}-function-url",
            function_name=fn.name,
            authorization_type="NONE",
            opts=pulumi.ResourceOptions(parent=self),
        )

        aws.lambda_.Permission(
            f"{name}-function-url-permission",
            action="lambda:InvokeFunctionUrl",
            function=fn.name,
            principal="*",
            function_url_auth_type="NONE",
            opts=pulumi.ResourceOptions(parent=self),
        )

        # --- Outputs ---
        self.function_url = fn_url.function_url

        self.register_outputs({
            "function_url": self.function_url,
        })
