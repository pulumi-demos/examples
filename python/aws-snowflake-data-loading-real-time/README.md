# AWS Snowflake Data Loading (Real-Time)

Load data into Snowflake in seconds using Pulumi ComponentResources. The default entrypoint (`__main__.py`) demonstrates the recommended pattern:

**Pattern A: Lambda -> Firehose -> Snowflake (direct)**
Data flows from GitHub webhooks through Lambda (HMAC validation) into Amazon Data Firehose, which streams directly to Snowflake via the Snowpipe Streaming API. Data lands in seconds. S3 is used only for backup/error records.

## Alternative patterns

Two additional patterns are included as self-contained entrypoints. To use one, copy it over `__main__.py`:

| Pattern | Entrypoint | Latency | Use Case |
|---------|-----------|---------|----------|
| **A (default)** | `__main__.py` | Seconds | Lowest latency, fewest resources |
| **B** | `__main_snowpipe__.py` | ~2 minutes | Need S3 as data lake or for compliance |
| **C** | `__main_batch__.py` | On schedule | Orchestrator-controlled loading |

```bash
# Switch to Pattern B (S3 auto-ingest via Snowpipe)
cp __main_snowpipe__.py __main__.py

# Switch to Pattern C (batch COPY INTO)
cp __main_batch__.py __main__.py
```

## Prerequisites

- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- AWS account with permissions to create Lambda, Firehose, S3, and IAM resources
- Snowflake account with `ACCOUNTADMIN` or equivalent privileges
- GitHub account with a test repository

## Setup

### 1. Install dependencies

```bash
uv sync
```

### 2. Configure Pulumi ESC environments

This project uses [Pulumi ESC](https://www.pulumi.com/docs/esc/) for dynamic credentials via OIDC. You need four ESC environments:

1. **AWS OIDC** — provides short-lived AWS credentials
2. **Snowflake OIDC** — provides short-lived Snowflake credentials
3. **Combined dev** — imports AWS + Snowflake, maps to `pulumiConfig`
4. **GitHub** — provides GitHub token for webhook creation

See the [companion blog post](https://www.pulumi.com/blog/near-real-time-data-loading-snowflake-pulumi/) for detailed ESC setup instructions.

> **Not using ESC?** You can set credentials manually via `pulumi config set` (e.g., `pulumi config set aws:region us-west-2`, `pulumi config set --secret snowflake:token <token>`). ESC is recommended for production but not required.

### 3. Create a stack

```bash
pulumi stack init dev
```

### 4. Configure the stack

Create `Pulumi.dev.yaml`:

```yaml
environment:
  - <your-org>/<project>/snowpipe-demo-dev
  - <your-org>/<project>/snowpipe-demo-github
config:
  aws-snowflake-data-loading-real-time:database: LANDING_ZONE_WEBHOOKS
  aws-snowflake-data-loading-real-time:environment: dev
  aws-snowflake-data-loading-real-time:webhook-repo: <your-test-repo>
  snowflake:previewFeaturesEnabled:
    - snowflake_storage_integration_resource
    - snowflake_stage_resource
    - snowflake_table_resource
    - snowflake_pipe_resource
```

### 5. Deploy

```bash
pulumi up
```

The entire stack deploys in about 2 minutes. Immediately after deployment, GitHub events will start flowing into Snowflake.

## Testing

After deployment, interact with your GitHub test repository (star it, push a commit, open an issue). Then query Snowflake:

```sql
-- Grant the reader role to your user (one-time)
GRANT ROLE DATA_READER TO USER <your-user>;

-- Query the direct ingestion table (Pattern A)
USE ROLE DATA_READER;
SELECT CONTENT:github_event::STRING AS event_type,
       CONTENT:payload:repository:full_name::STRING AS repo,
       METADATA:IngestionTime::TIMESTAMP AS ingested_at
FROM LANDING_ZONE_WEBHOOKS.GITHUB.REPOSITORY_EVENTS_DIRECT
ORDER BY ingested_at DESC;
```

Data should appear within ~30 seconds for Pattern A.

## Components

| File | Component | Description |
|------|-----------|-------------|
| `direct_snowflake_ingestion.py` | `DirectSnowflakeIngestion` | Pattern A: Lambda + Firehose -> Snowflake (direct) |
| `webhook_ingestion.py` | `WebhookIngestion` | Pattern B upstream: Lambda + Firehose -> S3 |
| `snowpipe_pipeline.py` | `SnowpipePipeline` | Pattern B downstream: S3 -> Snowpipe -> Snowflake |
| `webhook_to_snowflake.py` | `WebhookToSnowflake` | Composed: WebhookIngestion + SnowpipePipeline |
| `batch_stage.py` | `BatchStage` | Pattern C: External stage + tables with grants |
| `lambda/webhook_handler.py` | — | Lambda handler for GitHub webhook validation |

## Cleanup

```bash
pulumi destroy
```
