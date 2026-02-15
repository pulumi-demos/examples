"""Direct Firehose → Snowflake ComponentResource.

Encapsulates the pipeline that sends data directly from Firehose to Snowflake
using the Snowpipe Streaming API (Firehose native Snowflake destination).

No S3 → Snowpipe path needed — S3 is only for backup/errors.
"""

import json
from dataclasses import dataclass

import pulumi
import pulumi_aws as aws
import pulumi_snowflake as snowflake
import pulumi_tls as tls

from components.snowpipe_pipeline import ColumnDef


def strip_pem_headers(pem: str) -> str:
    """Remove PEM header/footer lines, returning only the base64 content."""
    lines = pem.strip().split("\n")
    return "".join(lines[1:-1])


@dataclass
class DirectSnowflakeIngestionArgs:
    """Arguments for the DirectSnowflakeIngestion component."""

    # S3 for backup/errors only
    bucket_arn: pulumi.Input[str]
    bucket_name: pulumi.Input[str]

    # Snowflake target
    database: pulumi.Input[str]
    schema_name: pulumi.Input[str]
    table_name: str
    table_columns: list[ColumnDef]

    # Snowflake account
    snowflake_account_url: pulumi.Input[str]
    snowflake_role_name: str

    # Lambda
    lambda_code: pulumi.Archive
    lambda_handler: str
    lambda_environment: dict[str, pulumi.Input[str]]

    # Optional
    table_comment: str = ""
    s3_prefix: str = "direct-webhooks"
    s3_backup_mode: str = "FailedDataOnly"
    buffering_interval: int = 0
    buffering_size: int = 1
    retry_duration: int = 60
    data_loading_option: str = "VARIANT_CONTENT_AND_METADATA_MAPPING"
    content_column_name: str = "CONTENT"
    metadata_column_name: str = "METADATA"


class DirectSnowflakeIngestion(pulumi.ComponentResource):
    """Reusable component for direct Firehose → Snowflake ingestion.

    Creates:
    - TLS key pair for Snowflake authentication
    - Snowflake service user, role, and grants
    - Snowflake landing table
    - Amazon Data Firehose with Snowflake destination
    - Lambda function with Function URL for webhook ingestion

    Outputs:
    - function_url: The public URL to use as the webhook endpoint
    - firehose_stream_name: The Firehose delivery stream name
    - snowflake_user_name: The Snowflake service user name
    """

    function_url: pulumi.Output[str]
    firehose_stream_name: pulumi.Output[str]
    snowflake_user_name: pulumi.Output[str]

    def __init__(
        self,
        name: str,
        args: DirectSnowflakeIngestionArgs,
        opts: pulumi.ResourceOptions | None = None,
    ):
        super().__init__(
            "snowpipe:direct:DirectSnowflakeIngestion", name, {}, opts
        )

        # --- TLS key pair for Snowflake auth ---
        key_pair = tls.PrivateKey(
            f"{name}-keypair",
            algorithm="RSA",
            rsa_bits=2048,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # --- Snowflake role, user, and grants ---
        sf_role = snowflake.AccountRole(
            f"{name}-sf-role",
            name=args.snowflake_role_name,
            opts=pulumi.ResourceOptions(parent=self),
        )

        user_name = f"FIREHOSE_{name.upper().replace('-', '_')}_USER"
        sf_user = snowflake.ServiceUser(
            f"{name}-sf-user",
            name=user_name,
            login_name=user_name,
            default_role=sf_role.name,
            rsa_public_key=key_pair.public_key_pem.apply(strip_pem_headers),
            opts=pulumi.ResourceOptions(parent=self),
        )

        snowflake.GrantAccountRole(
            f"{name}-sf-role-grant",
            role_name=sf_role.name,
            user_name=sf_user.name,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Landing table
        table = snowflake.Table(
            f"{name}-table",
            name=args.table_name,
            database=args.database,
            schema=args.schema_name,
            comment=args.table_comment,
            columns=[
                snowflake.TableColumnArgs(
                    name=col.name,
                    type=col.type,
                    nullable=col.nullable,
                )
                for col in args.table_columns
            ],
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Grants: DB USAGE, schema USAGE, table INSERT+SELECT
        snowflake.GrantPrivilegesToAccountRole(
            f"{name}-grant-db-usage",
            account_role_name=sf_role.name,
            privileges=["USAGE"],
            on_account_object=snowflake.GrantPrivilegesToAccountRoleOnAccountObjectArgs(
                object_type="DATABASE",
                object_name=args.database,
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        snowflake.GrantPrivilegesToAccountRole(
            f"{name}-grant-schema-usage",
            account_role_name=sf_role.name,
            privileges=["USAGE"],
            on_schema=snowflake.GrantPrivilegesToAccountRoleOnSchemaArgs(
                schema_name=pulumi.Output.all(
                    args.database, args.schema_name
                ).apply(lambda parts: f'"{parts[0]}"."{parts[1]}"'),
            ),
            opts=pulumi.ResourceOptions(parent=self),
        )

        table_name = args.table_name
        snowflake.GrantPrivilegesToAccountRole(
            f"{name}-grant-table",
            account_role_name=sf_role.name,
            privileges=["INSERT", "SELECT"],
            on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
                object_type="TABLE",
                object_name=pulumi.Output.all(
                    args.database, args.schema_name
                ).apply(
                    lambda parts: f'"{parts[0]}"."{parts[1]}"."{table_name}"'
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self, depends_on=[table]),
        )

        # --- Firehose IAM role (S3 backup write) ---
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

        # --- Firehose delivery stream (Snowflake destination) ---
        stream = aws.kinesis.FirehoseDeliveryStream(
            f"{name}-firehose",
            destination="snowflake",
            snowflake_configuration=aws.kinesis.FirehoseDeliveryStreamSnowflakeConfigurationArgs(
                account_url=args.snowflake_account_url,
                database=args.database,
                schema=args.schema_name,
                table=args.table_name,
                role_arn=firehose_role.arn,
                user=sf_user.name,
                private_key=key_pair.private_key_pem_pkcs8.apply(
                    strip_pem_headers
                ),
                data_loading_option=args.data_loading_option,
                content_column_name=args.content_column_name,
                metadata_column_name=args.metadata_column_name,
                s3_backup_mode=args.s3_backup_mode,
                buffering_size=args.buffering_size,
                buffering_interval=args.buffering_interval,
                retry_duration=args.retry_duration,
                snowflake_role_configuration=aws.kinesis.FirehoseDeliveryStreamSnowflakeConfigurationSnowflakeRoleConfigurationArgs(
                    enabled=True,
                    snowflake_role=args.snowflake_role_name,
                ),
                s3_configuration=aws.kinesis.FirehoseDeliveryStreamSnowflakeConfigurationS3ConfigurationArgs(
                    bucket_arn=args.bucket_arn,
                    role_arn=firehose_role.arn,
                    prefix=f"{args.s3_prefix}/backup/",
                    error_output_prefix=f"{args.s3_prefix}/errors/",
                ),
            ),
            opts=pulumi.ResourceOptions(parent=self, depends_on=[table]),
        )

        # --- Lambda function ---
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

        env_vars = {
            **args.lambda_environment,
            "FIREHOSE_STREAM_NAME": stream.name,
        }

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
        self.firehose_stream_name = stream.name
        self.snowflake_user_name = sf_user.name

        self.register_outputs({
            "function_url": self.function_url,
            "firehose_stream_name": self.firehose_stream_name,
            "snowflake_user_name": self.snowflake_user_name,
        })
