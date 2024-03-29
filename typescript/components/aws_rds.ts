import { rds } from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// Interface for backend args
export interface DbArgs {
  dbName: string;
  dbUser: string;
  dbPassword: pulumi.Output<string> | undefined;
  subnetIds: pulumi.Output<string[]> | pulumi.Output<string>[];
  securityGroupIds?: pulumi.Output<string[]> | pulumi.Output<string>[];
  publicAccess?: boolean;
}

// Creates DB
export class Db extends pulumi.ComponentResource {
  public readonly dbAddress: pulumi.Output<string>;
  public readonly dbName: pulumi.Output<string>;
  public readonly dbUser: pulumi.Output<string>;
  public readonly dbPassword: pulumi.Output<string | undefined>;

  constructor(name: string, args: DbArgs, opts?: pulumi.ComponentResourceOptions) {

    super("custom:resource:DB", name, args, opts);

    // Create RDS subnet grup
    const rdsSubnetGroupName = `${name}-sng`;
    const rdsSubnetGroup = new rds.SubnetGroup(rdsSubnetGroupName, {
      subnetIds: args.subnetIds,
      tags: { "Name": rdsSubnetGroupName},
    }, { parent: this });

    // RDS DB
    const rdsName = `${name}-rds`;
    const db = new rds.Instance(rdsName, {
      dbName: args.dbName,
      username: args.dbUser,
      password: args.dbPassword,
      vpcSecurityGroupIds: args.securityGroupIds,
      dbSubnetGroupName: rdsSubnetGroup.name,
      allocatedStorage: 20,
      engine: "mysql",
      engineVersion: "5.7",
      instanceClass: "db.t2.micro",
      storageType: "gp2",
      skipFinalSnapshot: true,
      publiclyAccessible: args.publicAccess ?? false,
    }, { parent: this });

    this.dbAddress = db.address;
    this.dbName = db.dbName;
    this.dbUser = db.username;
    this.dbPassword = db.password;

    this.registerOutputs({});
  }
}