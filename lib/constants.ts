import {BundlingOptions} from "aws-cdk-lib/aws-lambda-nodejs";
import {Duration} from "aws-cdk-lib";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {RetentionDays} from "aws-cdk-lib/aws-logs";

export const bundling: BundlingOptions = {
    minify: true,
    target: "ES2022",
    externalModules: ['aws-sdk'],
}

export const commonLambdaProps = {
    bundling,
    timeout: Duration.seconds(3),
    memorySize: 256,
    runtime: Runtime.NODEJS_18_X,
    logRetention: RetentionDays.THREE_DAYS
}
