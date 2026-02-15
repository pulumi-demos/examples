"""AWS Lambda handler for GitHub webhook ingestion.

Validates the HMAC-SHA256 signature, wraps the payload in an envelope
with the event type, and puts the record into Amazon Data Firehose.
"""

import hashlib
import hmac
import json
import os

import boto3

firehose = boto3.client("firehose")

STREAM_NAME = os.environ["FIREHOSE_STREAM_NAME"]
WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]


def handler(event, context):
    body = event.get("body", "")
    signature = (event.get("headers") or {}).get("x-hub-signature-256", "")

    # Validate HMAC-SHA256 signature
    expected = "sha256=" + hmac.new(
        WEBHOOK_SECRET.encode(), body.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        return {"statusCode": 401, "body": "Invalid signature"}

    github_event = (event.get("headers") or {}).get("x-github-event", "unknown")

    # Wrap in envelope — newline-delimited so Firehose can concatenate records
    record = json.dumps({
        "github_event": github_event,
        "payload": json.loads(body),
    }) + "\n"

    firehose.put_record(
        DeliveryStreamName=STREAM_NAME,
        Record={"Data": record.encode()},
    )

    return {"statusCode": 200, "body": "OK"}
