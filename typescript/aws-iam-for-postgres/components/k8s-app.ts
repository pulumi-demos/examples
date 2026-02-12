import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

export interface K8sRdsDemoAppArgs {
  provider: k8s.Provider;
  namespace: pulumi.Input<string>;
  serviceAccountName: string;
  iamRoleArn: pulumi.Input<string>;
  dbEndpoint: pulumi.Input<string>;
  dbName: string;
  dbUser: string;
  awsRegion: pulumi.Input<string>;
  replicas?: number;
}

export class K8sRdsDemoApp extends pulumi.ComponentResource {
  public readonly serviceAccount: k8s.core.v1.ServiceAccount;
  public readonly service: k8s.core.v1.Service;
  public readonly appUrl: pulumi.Output<string>;

  constructor(
    name: string,
    args: K8sRdsDemoAppArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:kubernetes:RdsDemoApp", name, {}, opts);

    const replicas = args.replicas || 1;

    // Create service account with IAM role annotation for IRSA
    this.serviceAccount = new k8s.core.v1.ServiceAccount(
      `${name}-sa`,
      {
        metadata: {
          name: args.serviceAccountName,
          namespace: args.namespace,
          annotations: {
            "eks.amazonaws.com/role-arn": args.iamRoleArn,
          },
        },
      },
      { parent: this, provider: args.provider }
    );

    // Create ConfigMap with scripts
    const configMap = new k8s.core.v1.ConfigMap(
      `${name}-config`,
      {
        metadata: {
          name: "db-scripts",
          namespace: args.namespace,
        },
        data: {
          "query-db.sh": this.getQueryDbScript(),
          "server.py": this.getServerScript(),
        },
      },
      { parent: this, provider: args.provider }
    );

    // Create application deployment (queries database with IAM auth)
    new k8s.apps.v1.Deployment(
      `${name}-deployment`,
      {
        metadata: {
          name: "rds-demo-app",
          namespace: args.namespace,
        },
        spec: {
          replicas: replicas,
          selector: {
            matchLabels: { app: "rds-demo" },
          },
          template: {
            metadata: {
              labels: { app: "rds-demo" },
            },
            spec: {
              serviceAccountName: this.serviceAccount.metadata.name,
              containers: [
                {
                  name: "app",
                  image: "python:3.11-slim",
                  command: ["/bin/bash", "/app/query-db.sh"],
                  ports: [{ containerPort: 8080 }],
                  env: [
                    { name: "DB_ENDPOINT", value: args.dbEndpoint },
                    { name: "DB_NAME", value: args.dbName },
                    { name: "DB_USER", value: args.dbUser },
                    { name: "AWS_REGION", value: args.awsRegion },
                  ],
                  resources: {
                    requests: {
                      cpu: "250m",
                      memory: "512Mi",
                    },
                    limits: {
                      cpu: "500m",
                      memory: "1Gi",
                    },
                  },
                  livenessProbe: {
                    httpGet: {
                      path: "/",
                      port: 8080,
                    },
                    initialDelaySeconds: 60,
                    periodSeconds: 30,
                    timeoutSeconds: 5,
                  },
                  readinessProbe: {
                    httpGet: {
                      path: "/",
                      port: 8080,
                    },
                    initialDelaySeconds: 30,
                    periodSeconds: 10,
                    timeoutSeconds: 5,
                  },
                  volumeMounts: [
                    {
                      name: "scripts",
                      mountPath: "/app",
                    },
                  ],
                },
              ],
              volumes: [
                {
                  name: "scripts",
                  configMap: {
                    name: configMap.metadata.name,
                    defaultMode: 0o755,
                  },
                },
              ],
            },
          },
        },
      },
      { parent: this, provider: args.provider }
    );

    // Create service
    this.service = new k8s.core.v1.Service(
      `${name}-service`,
      {
        metadata: {
          name: "rds-demo-service",
          namespace: args.namespace,
        },
        spec: {
          type: "LoadBalancer",
          selector: { app: "rds-demo" },
          ports: [
            {
              port: 80,
              targetPort: 8080,
              protocol: "TCP",
            },
          ],
        },
      },
      { parent: this, provider: args.provider }
    );

    // Extract app URL
    this.appUrl = this.service.status.apply((status) => {
      const ingress = status?.loadBalancer?.ingress?.[0];
      return ingress?.hostname || ingress?.ip || "pending";
    });

    this.registerOutputs({
      appUrl: this.appUrl,
    });
  }

  private getQueryDbScript(): string {
    return `#!/bin/bash
set -e

echo "Installing dependencies..."
apt-get update && apt-get install -y postgresql-client curl python3 python3-pip
pip3 install boto3 psycopg2-binary --break-system-packages

echo "Starting web server..."
python3 /app/server.py
`;
  }

  private getServerScript(): string {
    return `#!/usr/bin/env python3
import os
import boto3
import psycopg2
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import urllib.parse

DB_ENDPOINT = os.environ['DB_ENDPOINT']
DB_NAME = os.environ['DB_NAME']
DB_USER = os.environ.get('DB_USER', 'iamuser')
DB_PORT = 5432
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')
RDS_CA_CERT = '/tmp/rds-ca-bundle.pem'

def download_rds_ca_cert():
    """Download RDS CA certificate bundle"""
    if not os.path.exists(RDS_CA_CERT):
        print('Downloading RDS CA certificate bundle...')
        url = 'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem'
        urllib.request.urlretrieve(url, RDS_CA_CERT)
        print('RDS CA certificate downloaded successfully')

def get_iam_token():
    """Generate an IAM authentication token for RDS"""
    client = boto3.client('rds', region_name=AWS_REGION)
    token = client.generate_db_auth_token(
        DBHostname=DB_ENDPOINT,
        Port=DB_PORT,
        DBUsername=DB_USER,
        Region=AWS_REGION
    )
    return token

def get_db_connection():
    """Create a database connection with IAM auth"""
    download_rds_ca_cert()
    token = get_iam_token()
    return psycopg2.connect(
        host=DB_ENDPOINT,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=token,
        sslmode='require',
        sslrootcert=RDS_CA_CERT
    )

def create_table():
    """Create the messages table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        cursor.close()
        conn.close()
        return {'success': True, 'message': 'Table created successfully'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def add_message(message_text):
    """Add a message to the table"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO messages (message) VALUES (%s)", (message_text,))
        conn.commit()
        cursor.close()
        conn.close()
        return {'success': True, 'message': 'Message added successfully'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

def query_database():
    """Query all messages from the database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, message, created_at FROM messages ORDER BY id')
        rows = cursor.fetchall()

        messages = []
        for row in rows:
            messages.append({
                'id': row[0],
                'message': row[1],
                'created_at': str(row[2])
            })

        cursor.close()
        conn.close()
        return {'success': True, 'data': messages}
    except Exception as e:
        error_msg = str(e)
        if 'does not exist' in error_msg or 'relation' in error_msg:
            return {'success': True, 'data': [], 'warning': 'Table not created yet. Click "Create Table" button above.'}
        return {'success': False, 'error': error_msg}

def get_html_page(messages_result):
    """Generate HTML page with buttons and messages"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>RDS IAM Demo</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { color: #333; }
            .button-group { margin: 20px 0; }
            button { padding: 10px 20px; margin-right: 10px; font-size: 16px; cursor: pointer; }
            .create-btn { background-color: #4CAF50; color: white; border: none; }
            .add-btn { background-color: #2196F3; color: white; border: none; }
            .refresh-btn { background-color: #ff9800; color: white; border: none; }
            input[type="text"] { padding: 8px; width: 300px; font-size: 14px; }
            .message-list { margin-top: 20px; }
            .message { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .error { color: red; }
            .success { color: green; }
            .info { color: #666; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>RDS IAM Authentication Demo</h1>
            <div class="info">
                <strong>Database:</strong> """ + DB_ENDPOINT + """<br>
                <strong>User:</strong> """ + DB_USER + """ (IAM authenticated)
            </div>

            <div class="button-group">
                <form action="/create-table" method="post" style="display: inline;">
                    <button type="submit" class="create-btn">Create Table</button>
                </form>

                <form action="/add-message" method="post" style="display: inline;">
                    <input type="text" name="message" placeholder="Enter message..." required>
                    <button type="submit" class="add-btn">Add Message</button>
                </form>

                <button onclick="window.location.reload()" class="refresh-btn">Refresh</button>
            </div>
    """

    # Show page-level messages
    if messages_result.get('page_error'):
        html += f'<div style="padding: 10px; background: #ffebee; color: #c62828; margin: 10px 0; border-radius: 5px;">Error: {messages_result["page_error"]}</div>'
    if messages_result.get('page_success'):
        html += f'<div style="padding: 10px; background: #e8f5e9; color: #2e7d32; margin: 10px 0; border-radius: 5px;">{messages_result["page_success"]}</div>'

    html += """
            <div class="message-list">
                <h2>Messages:</h2>
    """

    if messages_result['success']:
        if messages_result.get('warning'):
            html += f'<p class="error">{messages_result["warning"]}</p>'
        elif messages_result['data']:
            for msg in messages_result['data']:
                html += f"""
                <div class="message">
                    <strong>#{msg['id']}</strong>: {msg['message']}<br>
                    <small>{msg['created_at']}</small>
                </div>
                """
        else:
            html += '<p>No messages yet. Add some messages above!</p>'
    else:
        html += f'<p class="error">Error: {messages_result.get("error", "Unknown error")}</p>'

    html += """
            </div>
        </div>
    </body>
    </html>
    """
    return html

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/'):
            # Parse query parameters for messages
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(self.path)
            query_params = parse_qs(parsed.query)

            result = query_database()

            # Add any error or success messages from query params
            if 'error' in query_params:
                result['page_error'] = query_params['error'][0]
            if 'msg' in query_params:
                result['page_success'] = query_params['msg'][0]

            html = get_html_page(result)

            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(html.encode())

        elif self.path == '/messages':
            result = query_database()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, indent=2).encode())

        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/create-table':
            result = create_table()
            if result.get('success'):
                self.send_response(303)
                self.send_header('Location', '/?msg=Table created successfully')
            else:
                self.send_response(303)
                self.send_header('Location', f'/?error={result.get("error", "Unknown error")}')
            self.end_headers()

        elif self.path == '/add-message':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length).decode('utf-8')
            params = urllib.parse.parse_qs(post_data)
            message = params.get('message', [''])[0]

            if message:
                result = add_message(message)

            self.send_response(303)
            self.send_header('Location', '/')
            self.end_headers()

        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), RequestHandler)
    print('Server running on port 8080...')
    print(f'Database: {DB_ENDPOINT}/{DB_NAME}')
    print(f'IAM User: {DB_USER}')
    server.serve_forever()
`;
  }
}
