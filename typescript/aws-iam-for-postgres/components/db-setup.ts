import * as pulumi from "@pulumi/pulumi";
import * as postgresql from "@pulumi/postgresql";

export interface DbSetupArgs {
  dbEndpoint: pulumi.Input<string>;
  dbName: string;
  masterUsername: string;
  masterPassword: pulumi.Input<string>;
  iamUsername: string;
}

export class DbSetup extends pulumi.ComponentResource {
  public readonly provider: postgresql.Provider;
  public readonly iamRole: postgresql.Role;

  constructor(
    name: string,
    args: DbSetupArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("custom:database:DbSetup", name, {}, opts);

    // Create PostgreSQL provider with password authentication
    this.provider = new postgresql.Provider(
      `${name}-provider`,
      {
        host: args.dbEndpoint,
        port: 5432,
        database: args.dbName,
        username: args.masterUsername,
        password: args.masterPassword,
        sslmode: "require",
        superuser: false,
        scheme: "awspostgres",
      },
      { parent: this }
    );

    // Create IAM-enabled database user
    this.iamRole = new postgresql.Role(
      `${name}-iam-user`,
      {
        name: args.iamUsername,
        login: true,
      },
      { parent: this, provider: this.provider }
    );

    // Grant rds_iam role to enable IAM authentication
    new postgresql.GrantRole(
      `${name}-grant-rds-iam`,
      {
        role: this.iamRole.name,
        grantRole: "rds_iam",
      },
      { parent: this, provider: this.provider }
    );

    // Grant database connection privileges
    new postgresql.Grant(
      `${name}-db-connect`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        objectType: "database",
        privileges: ["CONNECT"],
      },
      { parent: this, provider: this.provider }
    );

    // Grant schema privileges for creating tables and using the schema
    new postgresql.Grant(
      `${name}-schema-usage-create`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        schema: "public",
        objectType: "schema",
        privileges: ["USAGE", "CREATE"],
        withGrantOption: false,
      },
      { parent: this, provider: this.provider }
    );

    // Grant table privileges for existing tables
    new postgresql.Grant(
      `${name}-table-privileges`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        schema: "public",
        objectType: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      { parent: this, provider: this.provider }
    );

    // Grant sequence privileges (needed for SERIAL/auto-increment columns)
    new postgresql.Grant(
      `${name}-sequence-privileges`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        schema: "public",
        objectType: "sequence",
        privileges: ["USAGE", "SELECT"],
      },
      { parent: this, provider: this.provider }
    );

    // Set default privileges for future tables created by the master user
    new postgresql.DefaultPrivileges(
      `${name}-default-table-privs`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        schema: "public",
        owner: args.masterUsername,
        objectType: "table",
        privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"],
      },
      { parent: this, provider: this.provider }
    );

    // Set default privileges for future sequences created by the master user
    new postgresql.DefaultPrivileges(
      `${name}-default-sequence-privs`,
      {
        database: args.dbName,
        role: this.iamRole.name,
        schema: "public",
        owner: args.masterUsername,
        objectType: "sequence",
        privileges: ["USAGE", "SELECT"],
      },
      { parent: this, provider: this.provider }
    );

    this.registerOutputs({
      iamRoleName: this.iamRole.name,
    });
  }
}
