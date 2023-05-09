import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const bucket = new aws.s3.Bucket("main", {
    acl: "private",
    forceDestroy: true,
});

bucket.onObjectCreated("logger", new aws.lambda.CallbackFunction<aws.s3.BucketEvent, void>("loggerFn", {
    memorySize: 128,
    callback: (e) => {
        for (const rec of e.Records || []) {
            const [buck, key] = [rec.s3.bucket.name, rec.s3.object.key];
            console.log(`Object created: ${buck}/${key}`);
        }
    },
}));

export const bucketName = bucket.bucket;
