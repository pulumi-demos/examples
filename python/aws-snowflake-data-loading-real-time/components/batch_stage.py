"""Batch stage loading ComponentResource.

Translated from production TypeScript (staging.ts). Creates an external stage,
landing tables, and grants — but no pipes. Data is loaded via scheduled
COPY INTO from an orchestrator (e.g., Airflow, cron).
"""

from dataclasses import dataclass

import pulumi
import pulumi_snowflake as snowflake

from components.snowpipe_pipeline import ColumnDef, TableDef


@dataclass
class BatchStageArgs:
    """Arguments for the BatchStage component."""

    bucket_name: pulumi.Input[str]
    storage_integration: snowflake.StorageIntegrationAws
    database: pulumi.Input[str]
    schema_name: pulumi.Input[str]
    stage_name: str
    tables: list[TableDef]
    granted_role: str
    file_format: pulumi.Input[str] | None = None
    stage_comment: str = ""


class BatchStage(pulumi.ComponentResource):
    """Reusable component for batch/scheduled data loading.

    Creates:
    - An external stage pointing to the S3 bucket
    - Landing tables
    - Grants on stage and tables to a specified Snowflake role

    No pipes are created — data loading is controlled by your orchestrator
    running COPY INTO statements on a schedule. This gives you full control
    over error handling, deduplication, and loading frequency.
    """

    stage_fully_qualified_name: pulumi.Output[str]

    def __init__(
        self,
        name: str,
        args: BatchStageArgs,
        opts: pulumi.ResourceOptions | None = None,
    ):
        super().__init__("snowpipe:batch:BatchStage", name, {}, opts)

        bucket_url = pulumi.Output.concat("s3://", args.bucket_name)

        # Build optional file format args
        file_format_args = None
        if args.file_format is not None:
            file_format_args = snowflake.StageExternalS3FileFormatArgs(
                format_name=pulumi.Output.concat(
                    args.database,
                    ".",
                    args.schema_name,
                    ".",
                    args.file_format,
                ),
            )

        # External stage pointing to S3
        stage = snowflake.StageExternalS3(
            f"stage-{name}",
            name=args.stage_name,
            url=bucket_url,
            database=args.database,
            schema=args.schema_name,
            storage_integration=args.storage_integration.name,
            comment=args.stage_comment,
            file_format=file_format_args,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Grant USAGE on the stage to the loading role
        snowflake.GrantPrivilegesToAccountRole(
            f"grant-stage-{name}",
            account_role_name=args.granted_role,
            privileges=["USAGE"],
            on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
                object_type="STAGE",
                object_name=pulumi.Output.all(
                    stage.database, stage.schema, stage.name
                ).apply(lambda parts: f'"{parts[0]}"."{parts[1]}"."{parts[2]}"'),
            ),
            opts=pulumi.ResourceOptions(parent=self, depends_on=[stage]),
        )

        # Create landing tables and grant permissions
        for table_def in args.tables:
            table_resource_name = table_def.name.lower().replace("_", "-")
            table = snowflake.Table(
                f"table-{name}-{table_resource_name}",
                name=table_def.name.upper(),
                database=args.database,
                schema=args.schema_name,
                comment=table_def.comment,
                columns=[
                    snowflake.TableColumnArgs(
                        name=col.name,
                        type=col.type,
                        nullable=col.nullable,
                    )
                    for col in table_def.columns
                ],
                opts=pulumi.ResourceOptions(parent=self),
            )

            # Grant SELECT + INSERT on each table to the loading role
            snowflake.GrantPrivilegesToAccountRole(
                f"grant-table-{name}-{table_resource_name}",
                account_role_name=args.granted_role,
                privileges=["SELECT", "INSERT"],
                on_schema_object=snowflake.GrantPrivilegesToAccountRoleOnSchemaObjectArgs(
                    object_type="TABLE",
                    object_name=pulumi.Output.all(
                        args.database,
                        args.schema_name,
                        table_def.name.upper(),
                    ).apply(
                        lambda parts: f'"{parts[0]}"."{parts[1]}"."{parts[2]}"'
                    ),
                ),
                opts=pulumi.ResourceOptions(parent=self, depends_on=[table]),
            )

        # Expose the fully qualified stage name for use in COPY INTO statements
        self.stage_fully_qualified_name = pulumi.Output.all(
            stage.database, stage.schema, stage.name
        ).apply(lambda parts: f'"{parts[0]}"."{parts[1]}"."{parts[2]}"')

        self.register_outputs(
            {"stage_fully_qualified_name": self.stage_fully_qualified_name}
        )
