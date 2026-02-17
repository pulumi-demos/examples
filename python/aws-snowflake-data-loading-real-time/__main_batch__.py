"""Pattern C: S3 -> scheduled COPY INTO (batch loading).

This is an alternative entrypoint. To use it, copy it over __main__.py:

    cp __main_batch__.py __main__.py

Your orchestrator (Airflow, cron, etc.) controls when data loads via COPY INTO.
You get full control over timing, error handling, and deduplication.

See __main__.py for the recommended Pattern A (direct Firehose to Snowflake).
"""

import json

import pulumi
import pulumi_aws as aws
import pulumi_snowflake as snowflake

from components.batch_stage import BatchStage, BatchStageArgs
from components.snowpipe_pipeline import ColumnDef, TableDef

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

config = pulumi.Config()
database_name = config.get("database") or "LANDING_ZONE_WEBHOOKS"
environment = config.get("environment") or "dev"

current = aws.get_caller_identity()
account_id = current.account_id

# ---------------------------------------------------------------------------
# Shared infrastructure
# ---------------------------------------------------------------------------

# S3 bucket - data files land here for batch loading
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
# Pattern C: Batch Loading (scheduled)
# ---------------------------------------------------------------------------
# Data files land in S3 -> orchestrator runs COPY INTO on a schedule.
# You control timing, error handling, and deduplication.

LOADER_ROLE = "SNOWPIPE_LOADER"  # Role that will run COPY INTO

loader_role = snowflake.AccountRole(
    "loader-role",
    name=LOADER_ROLE,
)

events_table = TableDef(
    name="GITHUB_EVENTS",
    columns=STANDARD_COLUMNS,
    comment="GitHub event data loaded via scheduled batch COPY INTO",
)

batch = BatchStage(
    "github-events",
    BatchStageArgs(
        bucket_name=bucket.bucket,
        storage_integration=storage_integration,
        database=database.name,
        schema_name=schema.name,
        stage_name="GITHUB_EVENTS_STAGE",
        tables=[events_table],
        granted_role=LOADER_ROLE,
        stage_comment="External stage for GitHub event data",
    ),
    opts=pulumi.ResourceOptions(depends_on=[loader_role, policy_attachment]),
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
    "reader-grant-batch-table",
    account_role_name=reader_role.name,
    privileges=["SELECT"],
    on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
        object_type="TABLE",
        object_name=pulumi.Output.all(database.name, schema.name).apply(
            lambda args: f'"{args[0]}"."{args[1]}"."GITHUB_EVENTS"'
        ),
    ),
    opts=pulumi.ResourceOptions(depends_on=[batch]),
)

# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

pulumi.export("bucket_name", bucket.bucket)
pulumi.export("stage_fully_qualified_name", batch.stage_fully_qualified_name)
