# aws-ts-serverless

## Copy files to bucket

Once the stack has been provisioned:

```
$ aws s3 cp index.ts s3://$(pulumi stack output bucketName)/1
upload: ./index.ts to s3://main-b568df3/1
$ aws s3 cp index.ts s3://$(pulumi stack output bucketName)/2
upload: ./index.ts to s3://main-b568df3/2
$ aws s3 cp index.ts s3://$(pulumi stack output bucketName)/3
upload: ./index.ts to s3://main-b568df3/3
$
```

## To tail logs

Once the stack has been provisioned:

```
$ pulumi logs -f
Collecting logs for stack dev since 2019-09-04T06:35:03.000-07:00.

 2019-09-04T07:35:06.794-07:00[                      loggerFn] Object created: main-b568df3/1
 2019-09-04T07:35:10.841-07:00[                      loggerFn] Object created: main-b568df3/2
 2019-09-04T07:35:12.918-07:00[                      loggerFn] Object created: main-b568df3/3
^C
$
```

Note: If you get no output, it's likely because your AWS credentials are missing or incorrect.
Re-run with `pulumi logs -f --logtostderr -v=9` to see full debug/error output.
See https://github.com/pulumi/pulumi/issues/1926 for more info.

## Clean-up

Before you can `pulumi destroy`, you must remove all objects from the bucket:

```
$ aws s3 rm --recursive s3://$(pulumi stack output bucketName)/
delete: s3://main-b568df3/1
delete: s3://main-b568df3/3
delete: s3://main-b568df3/2
$
```


