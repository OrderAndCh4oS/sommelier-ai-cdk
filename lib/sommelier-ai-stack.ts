import {CfnResource, Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Code, Function, Handler, Runtime} from 'aws-cdk-lib/aws-lambda'

import {Construct} from 'constructs';
import {AuthorizationType, CfnAuthorizer, Cors, LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {PolicyDocument, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";

export class SommelierAiCdkStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps, envs?: Environment) {
        super(scope, id, props);

        if (!envs) throw Error('Missing envs param');

        const bucket = new Bucket(this, 'SommelierAi_Bucket', {
            bucketName: envs.BUCKET_NAME,
        });

        /**
         * pk: userId
         * sk: wineNameSlug_shortUuid
         * data: style, country, region, vintage, name, score, tastingNote, embedding, status
         */
        const wineListDb = new Table(this, 'SommelierAi_WineListTable', {
            partitionKey: { name: 'userId', type: AttributeType.STRING },
            sortKey: { name: 'sk', type: AttributeType.STRING}
        });

        wineListDb.addLocalSecondaryIndex({
            indexName: 'statusKey',
            sortKey: {name: 'status', type: AttributeType.NUMBER} // enum 1=published, 0=unpublished (other numbers could be used for draft etc.)
        });

        /**
         * userId
         * data: name, bio, avatar, socialLinks, website
         */
        const usersDb = new Table(this, 'SommelierAi_UserTable', {
            partitionKey: { name: 'userId', type: AttributeType.STRING },
        });

        const apiKeyDb = new Table(this, 'SommelierAi_ApiKeyTable', {
            partitionKey: { name: 'apiKey', type: AttributeType.STRING },
        });

        apiKeyDb.addGlobalSecondaryIndex({
            indexName: 'userIdKey',
            partitionKey: { name: 'userId', type: AttributeType.STRING },
        })

        const role = new Role(this, 'SommelierAi_Role', {
            roleName: 'sommelier-ai-role',
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            inlinePolicies: {
                allowLambdaInvocation: PolicyDocument.fromJson({
                    Version: '2012-10-17',
                    Statement: [
                        {
                            Effect: 'Allow',
                            Action: ['lambda:InvokeFunction', 'lambda:InvokeAsync'],
                            Resource: `arn:aws:lambda:${envs.REGION}:${envs.ACCOUNT}:function:*`,
                        },
                    ],
                }),
            },
        });

        const api = new RestApi(this, 'SommelierAi_Api', {
            defaultCorsPreflightOptions: {
                allowHeaders: Cors.DEFAULT_HEADERS,
                allowMethods: Cors.ALL_METHODS,
                allowOrigins: envs.DOMAIN_NAMES
            }
        });

        const authorizerHandler = new NodejsFunction(this, 'SommelierAi_CustomAuthorizer', {
            entry: 'lambda/handlers/auth0-authoriser.ts',
            environment: {
                AUTH0_ISSUER: 'https://gpt-3-auth.eu.auth0.com/',
                AUTH0_AUDIENCE: 'https://gpt-3-demo.com',
                REGION: envs.REGION,
                ACCOUNT: envs.ACCOUNT,

            }
        });

        const authorizer = new CfnAuthorizer(this, 'SommelierAi_Authoriser', {
            restApiId: api.restApiId,
            type: 'TOKEN',
            name: 'sommelier-ai-authoriser',
            identitySource: 'method.request.header.Authorization',
            authorizerUri: `arn:aws:apigateway:${envs.REGION}:lambda:path/2015-03-31/functions/${authorizerHandler.functionArn}/invocations`,
            authorizerCredentials: role.roleArn
        });

        const authoriserLogicalId = authorizer.logicalId;

        const tastingNotesHandler = new NodejsFunction(this, 'SommelierAiCustom_TastingNotes', {
            entry: 'lambda/handlers/tasting-notes.ts',
            timeout: Duration.seconds(6),
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY
            }
        });

        const tastingNotesRoute = api.root.addResource('tasting-notes').addMethod(
            'post',
            new LambdaIntegration(tastingNotesHandler),
            {
                authorizationType: AuthorizationType.CUSTOM,
            }
        );
        const resource = tastingNotesRoute.node.findChild('Resource');

        (resource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (resource as CfnResource).addPropertyOverride('AuthorizerId', {Ref: authoriserLogicalId});

        const recommendationsHandler = new NodejsFunction(this, 'SommelierAiCustom_RecommendationsLambda', {
            entry: 'lambda/handlers/recommendations.ts',
            timeout: Duration.seconds(6),
            memorySize: 1024,
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY,
                BUCKET_NAME: envs.BUCKET_NAME
            },
        });

        const recommendationsRoute = api.root.addResource('recommendations').addMethod(
            'post',
            new LambdaIntegration(recommendationsHandler),
            {
                authorizationType: AuthorizationType.CUSTOM,
            }
        );
        const recommendationsResource = recommendationsRoute.node.findChild('Resource');

        (recommendationsResource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (recommendationsResource as CfnResource).addPropertyOverride('AuthorizerId', {Ref: authoriserLogicalId});

        bucket.grantRead(recommendationsHandler);
    }
}

