"""Pattern B: GitHub webhooks -> Lambda -> Firehose -> S3 -> Snowpipe auto-ingest.

This is an alternative entrypoint. To use it, copy it over __main__.py:

    cp __main_snowpipe__.py __main__.py

Data lands in S3 first (for data lake / compliance), then Snowpipe auto-ingests
into Snowflake. Latency is about two minutes.

See __main__.py for the recommended Pattern A (direct Firehose to Snowflake).
"""

import json

import pulumi
import pulumi_aws as aws
import pulumi_github as github
import pulumi_random as random
import pulumi_snowflake as snowflake

from components.snowpipe_pipeline import (
    ColumnDef,
    PipeDef,
    SnowpipePipeline,
    SnowpipePipelineArgs,
    TableDef,
)
from components.webhook_ingestion import WebhookIngestion, WebhookIngestionArgs

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

config = pulumi.Config()
database_name = config.get("database") or "LANDING_ZONE_WEBHOOKS"
environment = config.get("environment") or "dev"
webhook_repo = config.require("webhook-repo")

current = aws.get_caller_identity()
account_id = current.account_id

# ---------------------------------------------------------------------------
# Shared infrastructure
# ---------------------------------------------------------------------------

# S3 bucket - Firehose buffers webhook data here, Snowpipe reads from here
bucket = aws.s3.Bucket(
    "data-landing-bucket",
    force_destroy=True,  # Demo only - remove in production
)

# Snowflake database and schema
database = snowflake.Database("demo-database", name=database_name)

schema = snowflake.Schema(
    "demo-schema",
    name="GITHUB",
    database=database.name,
)

# ---------------------------------------------------------------------------
# Storage Integration + IAM Role (breaking the circular dependency)
# ---------------------------------------------------------------------------
#
# Snowflake's StorageIntegration needs an IAM role ARN, and the IAM role's
# trust policy needs Snowflake's IAM user ARN + external ID (which come from
# the StorageIntegration). This creates a circular dependency.
#
# The fix: use a FIXED IAM role name so we can construct the ARN before
# the role exists, then create the StorageIntegration first.
#
FIXED_ROLE_NAME = f"snowpipe-demo-{environment}-role"

storage_integration = snowflake.StorageIntegrationAws(
    "storage-integration",
    name="SNOWPIPE_DEMO_INTEGRATION",
    enabled=True,
    storage_aws_role_arn=f"arn:aws:iam::{account_id}:role/{FIXED_ROLE_NAME}",
    storage_provider="S3",
    storage_allowed_locations=[bucket.bucket.apply(lambda b: f"s3://{b}/")],
)

sf_iam_user_arn = storage_integration.describe_outputs.apply(
    lambda d: d[0].iam_user_arn
)
sf_external_id = storage_integration.describe_outputs.apply(
    lambda d: d[0].external_id
)

iam_role = aws.iam.Role(
    "snowpipe-role",
    name=FIXED_ROLE_NAME,
    assume_role_policy=pulumi.Output.all(
        sf_iam_user_arn,
        sf_external_id,
    ).apply(
        lambda args: json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": "sts:AssumeRole",
                        "Principal": {"AWS": args[0]},
                        "Condition": {
                            "StringEquals": {"sts:ExternalId": args[1]}
                        },
                    }
                ],
            }
        )
    ),
)

s3_policy = aws.iam.Policy(
    "snowpipe-s3-access",
    path="/",
    description="Consolidated S3 access for Snowpipe",
    policy=pulumi.Output.all(bucket.arn).apply(
        lambda arns: json.dumps(
            {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": ["s3:GetObject", "s3:GetObjectVersion"],
                        "Resource": [f"{arn}/*" for arn in arns],
                    },
                    {
                        "Effect": "Allow",
                        "Action": ["s3:ListBucket"],
                        "Resource": list(arns),
                    },
                ],
            }
        )
    ),
)

policy_attachment = aws.iam.PolicyAttachment(
    "snowpipe-s3-policy-attachment",
    roles=[iam_role.name],
    policy_arn=s3_policy.arn,
)

# ---------------------------------------------------------------------------
# Column definitions
# ---------------------------------------------------------------------------

# Standard metadata columns for S3-based loading.
# Every landing table gets the same four columns for consistent lineage:
#   FILENAME          - S3 object key (metadata$filename in COPY INTO)
#   LAST_MODIFIED_AT  - File timestamp (metadata$file_last_modified)
#   CONTENT           - Raw payload (parsed JSON object)
#   LOADED_AT         - When the row was loaded (sysdate())
STANDARD_COLUMNS = [
    ColumnDef(name="FILENAME", type="STRING", nullable=False),
    ColumnDef(name="LAST_MODIFIED_AT", type="TIMESTAMP_NTZ", nullable=False),
    ColumnDef(name="CONTENT", type="VARIANT", nullable=True),
    ColumnDef(name="LOADED_AT", type="TIMESTAMP_NTZ", nullable=True),
]

# ---------------------------------------------------------------------------
# Pattern B: GitHub Webhooks -> Lambda -> Firehose -> S3 -> Snowpipe
# ---------------------------------------------------------------------------

# Step 1: Upstream pipeline - Lambda validates webhooks, Firehose buffers to S3
webhook_secret = random.RandomPassword(
    "github-webhook-secret", length=32, special=False
)

webhook = WebhookIngestion(
    "github-webhooks",
    WebhookIngestionArgs(
        bucket_arn=bucket.arn,
        bucket_name=bucket.bucket,
        lambda_code=pulumi.AssetArchive({
            "webhook_handler.py": pulumi.FileAsset("lambda/webhook_handler.py"),
        }),
        lambda_handler="webhook_handler.handler",
        lambda_environment={"WEBHOOK_SECRET": webhook_secret.result},
    ),
)

# Step 2: GitHub webhook - sends events to the Lambda Function URL
github.RepositoryWebhook(
    "github-webhook",
    repository=webhook_repo,
    configuration=github.RepositoryWebhookConfigurationArgs(
        url=webhook.function_url,
        content_type="json",
        secret=webhook_secret.result,
    ),
    events=["push", "pull_request", "issues", "star"],
)

# Step 3: Snowpipe - auto-ingests files from S3 into Snowflake
webhooks_table = TableDef(
    name="REPOSITORY_EVENTS",
    columns=STANDARD_COLUMNS,
    comment="GitHub webhook events loaded via Snowpipe auto-ingest",
)

webhooks_pipe = PipeDef(
    name="REPOSITORY_EVENTS_PIPE",
    target_table="REPOSITORY_EVENTS",
    copy_statement=pulumi.Output.all(
        database.name, schema.name
    ).apply(
        lambda args: (
            f'COPY INTO "{args[0]}"."{args[1]}"."REPOSITORY_EVENTS" '
            f"FROM ("
            f"SELECT metadata$filename, metadata$file_last_modified, "
            f'$1, sysdate() FROM @"{args[0]}"."{args[1]}"."REPOSITORY_EVENTS_STAGE"'
            f") "
            f"file_format = (type = JSON) "
            f"PATTERN = 'github-webhooks/.*'"
        )
    ),
    comment="Auto-ingest pipe for GitHub webhook events",
)

snowpipe = SnowpipePipeline(
    "github-webhooks",
    SnowpipePipelineArgs(
        bucket_name=bucket.bucket,
        storage_integration=storage_integration,
        database=database.name,
        schema_name=schema.name,
        stage_name="REPOSITORY_EVENTS_STAGE",
        tables=[webhooks_table],
        pipes=[webhooks_pipe],
        stage_comment="External stage for GitHub webhook data",
    ),
    opts=pulumi.ResourceOptions(depends_on=[policy_attachment]),
)

# Step 4: Wire S3 bucket notifications to the Snowpipe SQS queue
aws.s3.BucketNotification(
    "webhooks-notification",
    bucket=bucket.bucket,
    queues=[
        aws.s3.BucketNotificationQueueArgs(
            queue_arn=snowpipe.notification_channel,
            events=["s3:ObjectCreated:*"],
            filter_prefix="github-webhooks/",
        )
    ],
)

# ---------------------------------------------------------------------------
# Least-privilege reader role
# ---------------------------------------------------------------------------

reader_role = snowflake.AccountRole("reader-role", name="DATA_READER")

snowflake.GrantPrivilegesToAccountRole(
    "reader-grant-db-usage",
    account_role_name=reader_role.name,
    privileges=["USAGE"],
    on_account_object=snowflake.GrantPrivilegesToAccountRoleOnAccountObjectArgs(
        object_type="DATABASE",
        object_name=database.name,
    ),
)

snowflake.GrantPrivilegesToAccountRole(
    "reader-grant-schema-usage",
    account_role_name=reader_role.name,
    privileges=["USAGE"],
    on_schema=snowflake.GrantPrivilegesToAccountRoleOnSchemaArgs(
        schema_name=pulumi.Output.all(database.name, schema.name).apply(
            lambda args: f'"{args[0]}"."{args[1]}"'
        ),
    ),
)

snowflake.GrantPrivilegesToAccountRole(
    "reader-grant-snowpipe-table",
    account_role_name=reader_role.name,
    privileges=["SELECT"],
    on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
        object_type="TABLE",
        object_name=pulumi.Output.all(database.name, schema.name).apply(
            lambda args: f'"{args[0]}"."{args[1]}"."REPOSITORY_EVENTS"'
        ),
    ),
    opts=pulumi.ResourceOptions(depends_on=[snowpipe]),
)

# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

pulumi.export("bucket_name", bucket.bucket)
pulumi.export("webhook_url", webhook.function_url)
pulumi.export("notification_channel", snowpipe.notification_channel)
