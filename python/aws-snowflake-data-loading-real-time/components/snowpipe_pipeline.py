"""Auto-ingest Snowpipe ComponentResource.

Translated from production TypeScript (snowpipe.ts). Creates an external stage,
landing tables, and Snowpipe pipes with auto_ingest=True for real-time loading.
"""

from dataclasses import dataclass

import pulumi
import pulumi_snowflake as snowflake


@dataclass
class ColumnDef:
    """Column definition for a Snowflake table."""

    name: str
    type: str
    nullable: bool = True


@dataclass
class TableDef:
    """Table definition for a Snowpipe landing table."""

    name: str
    columns: list[ColumnDef]
    comment: str = ""


@dataclass
class PipeDef:
    """Pipe definition for a Snowpipe auto-ingest pipe."""

    name: str
    copy_statement: pulumi.Input[str]
    target_table: str
    comment: str = ""


@dataclass
class SnowpipePipelineArgs:
    """Arguments for the SnowpipePipeline component."""

    bucket_name: pulumi.Input[str]
    storage_integration: snowflake.StorageIntegrationAws
    database: pulumi.Input[str]
    schema_name: pulumi.Input[str]
    stage_name: str
    tables: list[TableDef]
    pipes: list[PipeDef]
    stage_comment: str = ""


class SnowpipePipeline(pulumi.ComponentResource):
    """Reusable component for auto-ingest Snowpipe data loading.

    Creates:
    - An external stage pointing to the S3 bucket
    - Landing tables with standard metadata columns
    - Snowpipe pipes with auto_ingest for real-time loading

    Production patterns included:
    - delete_before_replace on pipes (Snowflake can't update in-place)
    - Per-pipe target dependencies via PipeDef.target_table
    - Exposes notification_channel for flexible S3 event wiring
    """

    notification_channel: pulumi.Output[str]

    def __init__(
        self,
        name: str,
        args: SnowpipePipelineArgs,
        opts: pulumi.ResourceOptions | None = None,
    ):
        super().__init__("snowpipe:pipeline:SnowpipePipeline", name, {}, opts)

        bucket_url = pulumi.Output.concat("s3://", args.bucket_name)

        # External stage pointing to S3
        stage = snowflake.StageExternalS3(
            f"stage-{name}",
            name=args.stage_name,
            url=bucket_url,
            database=args.database,
            schema=args.schema_name,
            storage_integration=args.storage_integration.name,
            comment=args.stage_comment,
            opts=pulumi.ResourceOptions(parent=self),
        )

        # Create landing tables
        table_lookup: dict[str, snowflake.Table] = {}
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
            table_lookup[table_def.name] = table

        # Create auto-ingest pipes
        pipes_created: list[snowflake.Pipe] = []
        for pipe_def in args.pipes:
            pipe_resource_name = pipe_def.name.lower().replace("_", "-")
            target = table_lookup.get(pipe_def.target_table)
            deps = [stage] + ([target] if target else [])
            pipe = snowflake.Pipe(
                f"pipe-{name}-{pipe_resource_name}",
                name=pipe_def.name.upper(),
                auto_ingest=True,
                comment=pipe_def.comment,
                copy_statement=pipe_def.copy_statement,
                database=args.database,
                schema=args.schema_name,
                opts=pulumi.ResourceOptions(
                    parent=self,
                    depends_on=deps,
                    # Snowflake cannot update pipes in-place,
                    # so we delete first then recreate
                    delete_before_replace=True,
                ),
            )
            pipes_created.append(pipe)

        # Expose the SQS notification channel from the first pipe.
        # This lets callers wire up S3 bucket notifications flexibly,
        # including cross-account scenarios.
        self.notification_channel = pipes_created[0].notification_channel

        self.register_outputs(
            {"notification_channel": self.notification_channel}
        )
