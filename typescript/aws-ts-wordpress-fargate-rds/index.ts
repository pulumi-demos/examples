/* 
 * Deploys:
 * - Network: VPC, Subnets, Security Groups
 * - DB Backend: MySQL RDS
 * - FrontEnd: WordPress in Fargate
*/

// Pulumi SDKs
import * as pulumi from "@pulumi/pulumi";
import * as pulumiservice from "@pulumi/pulumiservice";

// Components
import { Vpc } from "aws_network";
import { Db } from "aws_rds_backend";
import { WebService } from "aws_ecs_frontend";

// Local Modules
import { nameBase, dbName, dbUser, dbPassword } from "./config";

// Create an AWS VPC and subnets, etc
const network = new Vpc(`${baseName}-net`)
subnet_ids=network.subnet_ids

# Create a backend DB instance
be=Db(f'{service_name}-be', DbArgs(
    db_name=db_name,
    db_user=db_user,
    db_password=db_password,
    # publicly_accessible=True,  # Uncomment this to override for testing
    subnet_ids=subnet_ids,
    security_group_ids=[network.rds_security_group.id]
))

fe=WebService(f'{service_name}-fe', WebServiceArgs(
    db_host=be.db.address,
    db_port='3306',
    db_name=be.db.name,
    db_user=be.db.username,
    db_password=be.db.password,
    vpc_id=network.vpc.id,
    subnet_ids=subnet_ids,
    security_group_ids=[network.fe_security_group.id]
))

web_url=pulumi.Output.concat('http://', fe.alb.dns_name)
pulumi.export('Web Service URL', web_url)
pulumi.export('ECS Cluster Name', fe.cluster.name)

pulumi.export('DB Endpoint', be.db.address)
pulumi.export('DB User Name', be.db.username)
pulumi.export('DB Password', be.db.password)








// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Export the name of the bucket
export const bucketName = bucket.id;
