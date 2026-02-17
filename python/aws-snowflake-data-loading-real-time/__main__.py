"""Production-grade data loading: GitHub webhooks -> Firehose -> Snowflake.

Demonstrates Pattern A (direct Firehose to Snowflake), the recommended
approach for lowest latency. Data lands in Snowflake within seconds.

Alternative entrypoints for S3-based patterns:
- __main_snowpipe__.py  (Pattern B: Firehose -> S3 -> Snowpipe auto-ingest)
- __main_batch__.py     (Pattern C: S3 -> scheduled COPY INTO)

To switch: cp __main_snowpipe__.py __main__.py  (or __main_batch__.py)
"""

import pulumi
import pulumi_github as github
import pulumi_random as random
import pulumi_snowflake as snowflake
import pulumi_aws as aws

from components.direct_snowflake_ingestion import (
    DirectSnowflakeIngestion,
    DirectSnowflakeIngestionArgs,
)
from components.snowpipe_pipeline import ColumnDef

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

config = pulumi.Config()
database_name = config.get("database") or "LANDING_ZONE_WEBHOOKS"
webhook_repo = config.require("webhook-repo")

snowflake_config = pulumi.Config("snowflake")
snowflake_account_url = (
    f"https://{snowflake_config.require('organizationName')}"
    f"-{snowflake_config.require('accountName')}"
    f".snowflakecomputing.com"
)

# ---------------------------------------------------------------------------
# Shared infrastructure
# ---------------------------------------------------------------------------

# S3 bucket - used for Firehose backup/error records
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
# Column definitions
# ---------------------------------------------------------------------------

# Firehose writes CONTENT (webhook JSON) and METADATA (Firehose metadata
# including IngestionTime) directly as VARIANT columns.
DIRECT_COLUMNS = [
    ColumnDef(name="CONTENT", type="VARIANT", nullable=True),
    ColumnDef(name="METADATA", type="VARIANT", nullable=True),
]

# ---------------------------------------------------------------------------
# Pattern A: GitHub Webhooks -> Lambda -> Firehose -> Snowflake (direct)
# ---------------------------------------------------------------------------
# Amazon Data Firehose supports Snowflake as a native destination via the
# Snowpipe Streaming API. This bypasses the S3 -> Snowpipe path entirely.
# S3 is used only for backup/error records. Data lands in seconds.

direct_webhook_secret = random.RandomPassword(
    "github-direct-webhook-secret", length=32, special=False
)

direct = DirectSnowflakeIngestion(
    "github-webhooks-direct",
    DirectSnowflakeIngestionArgs(
        bucket_arn=bucket.arn,
        bucket_name=bucket.bucket,
        database=database.name,
        schema_name=schema.name,
        table_name="REPOSITORY_EVENTS_DIRECT",
        table_columns=DIRECT_COLUMNS,
        table_comment="GitHub webhook events loaded via direct Firehose to Snowflake",
        snowflake_account_url=snowflake_account_url,
        snowflake_role_name="FIREHOSE_DIRECT_LOADER",
        lambda_code=pulumi.AssetArchive({
            "webhook_handler.py": pulumi.FileAsset("lambda/webhook_handler.py"),
        }),
        lambda_handler="webhook_handler.handler",
        lambda_environment={"WEBHOOK_SECRET": direct_webhook_secret.result},
    ),
)

github.RepositoryWebhook(
    "github-direct-webhook",
    repository=webhook_repo,
    configuration=github.RepositoryWebhookConfigurationArgs(
        url=direct.function_url,
        content_type="json",
        secret=direct_webhook_secret.result,
    ),
    events=["push", "pull_request", "issues", "star"],
)

# ---------------------------------------------------------------------------
# Least-privilege reader role
# ---------------------------------------------------------------------------
# A dedicated role with SELECT-only access to the landing table.
# Use this role for querying data - never query with ACCOUNTADMIN.

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
    "reader-grant-direct-table",
    account_role_name=reader_role.name,
    privileges=["SELECT"],
    on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
        object_type="TABLE",
        object_name=pulumi.Output.all(database.name, schema.name).apply(
            lambda args: f'"{args[0]}"."{args[1]}"."REPOSITORY_EVENTS_DIRECT"'
        ),
    ),
    opts=pulumi.ResourceOptions(depends_on=[direct]),
)

# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

pulumi.export("bucket_name", bucket.bucket)
pulumi.export("webhook_url", direct.function_url)
pulumi.export("firehose_stream", direct.firehose_stream_name)
