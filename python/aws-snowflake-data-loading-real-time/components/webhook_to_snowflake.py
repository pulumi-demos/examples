"""Composed WebhookToSnowflake ComponentResource.

Wraps WebhookIngestion + SnowpipePipeline + GitHub webhook + S3 notification
into a single reusable component for the full webhook -> Snowflake flow.

Note on BucketNotification: This component manages S3 notifications for its
prefix. If multiple components share a bucket, use the individual components
and combine notifications externally - AWS allows only one
BucketNotification resource per bucket.
"""

from dataclasses import dataclass

import pulumi
import pulumi_aws as aws
import pulumi_github as github
import pulumi_random as random
import pulumi_snowflake as snowflake

from components.snowpipe_pipeline import (
    PipeDef,
    SnowpipePipeline,
    SnowpipePipelineArgs,
    TableDef,
)
from components.webhook_ingestion import WebhookIngestion, WebhookIngestionArgs


@dataclass
class WebhookToSnowflakeArgs:
    """Arguments for the WebhookToSnowflake composed component."""

    bucket_arn: pulumi.Input[str]
    bucket_name: pulumi.Input[str]
    storage_integration: snowflake.StorageIntegrationAws
    database: pulumi.Input[str]
    schema_name: pulumi.Input[str]
    stage_name: str
    tables: list[TableDef]
    pipes: list[PipeDef]
    repository: str
    events: list[str]
    lambda_code: pulumi.Archive
    lambda_handler: str
    s3_prefix: str = "github-webhooks"


class WebhookToSnowflake(pulumi.ComponentResource):
    """End-to-end webhook ingestion into Snowflake.

    Composes:
    - WebhookIngestion (Lambda + Firehose -> S3)
    - SnowpipePipeline (Stage + Tables + Pipes)
    - GitHub RepositoryWebhook
    - S3 BucketNotification

    Outputs:
    - function_url: The Lambda Function URL for the webhook endpoint
    - notification_channel: The SQS ARN used by Snowpipe
    """

    function_url: pulumi.Output[str]
    notification_channel: pulumi.Output[str]

    def __init__(
        self,
        name: str,
        args: WebhookToSnowflakeArgs,
        opts: pulumi.ResourceOptions | None = None,
    ):
        super().__init__(
            "snowpipe:composed:WebhookToSnowflake", name, {}, opts
        )

        # Generate webhook secret for HMAC validation
        secret = random.RandomPassword(
            f"{name}-webhook-secret",
            length=32,
            special=False,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Step 1: Upstream pipeline - Lambda validates, Firehose buffers to S3
        ingestion = WebhookIngestion(
            f"{name}-ingestion",
            WebhookIngestionArgs(
                bucket_arn=args.bucket_arn,
                bucket_name=args.bucket_name,
                lambda_code=args.lambda_code,
                lambda_handler=args.lambda_handler,
                lambda_environment={"WEBHOOK_SECRET": secret.result},
                s3_prefix=args.s3_prefix,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Step 2: GitHub webhook - sends events to the Lambda Function URL
        github.RepositoryWebhook(
            f"{name}-webhook",
            repository=args.repository,
            configuration=github.RepositoryWebhookConfigurationArgs(
                url=ingestion.function_url,
                content_type="json",
                secret=secret.result,
            ),
            events=args.events,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Step 3: Snowpipe - auto-ingests files from S3 into Snowflake
        pipeline = SnowpipePipeline(
            f"{name}-pipeline",
            SnowpipePipelineArgs(
                bucket_name=args.bucket_name,
                storage_integration=args.storage_integration,
                database=args.database,
                schema_name=args.schema_name,
                stage_name=args.stage_name,
                tables=args.tables,
                pipes=args.pipes,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Step 4: Wire S3 notifications to the Snowpipe SQS queue
        aws.s3.BucketNotification(
            f"{name}-notification",
            bucket=args.bucket_name,
            queues=[
                aws.s3.BucketNotificationQueueArgs(
                    queue_arn=pipeline.notification_channel,
                    events=["s3:ObjectCreated:*"],
                    filter_prefix=f"{args.s3_prefix}/",
                )
            ],
            opts=pulumi.ResourceOptions(parent=self),
        )

        self.function_url = ingestion.function_url
        self.notification_channel = pipeline.notification_channel

        self.register_outputs({
            "function_url": self.function_url,
            "notification_channel": self.notification_channel,
        })
