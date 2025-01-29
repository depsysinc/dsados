import * as cdk from 'aws-cdk-lib';
import { Distribution, PriceClass, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { Bucket, StorageClass } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';

export class DepSysWebStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const domainName = 'depsys.io'; // Replace with your domain
    const hostedZoneId = 'Z07217081TQFCOCNRKUIT'; // Replace with your hosted zone ID

    // Create the S3 bucket
    const bucket = new Bucket(this, 'WebsiteBucket', {
      bucketName: `${domainName}-website-bucket`,
      // TODO: switch storage class, maybe to INTELLIGENT_TIERING
    });

    // Get the certificate
    const certificate = Certificate.fromCertificateArn(this, 'Certificate',
      'arn:aws:acm:us-east-1:533267180801:certificate/0c2819d4-ef28-44b1-b87e-679d8d62935c'
    );

    // Create the CloudFront distribution
    const distribution = new Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      priceClass: PriceClass.PRICE_CLASS_100,
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [domainName],
    });

    // Look up the hosted zone
    const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      zoneName: domainName,
      hostedZoneId: hostedZoneId,
    });

    // Create a Route53 A Record pointing to CloudFront
    const arecord = new ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: domainName,
      target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
    });

    // Deploy files
    const deployment = new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset('../dist')],
      destinationBucket: bucket
    });
  }
}
