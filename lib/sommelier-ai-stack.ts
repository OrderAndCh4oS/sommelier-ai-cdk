import {CfnResource, Duration, Stack, StackProps} from 'aws-cdk-lib';

import {Construct} from 'constructs';
import {
    ApiKey,
    AuthorizationType,
    CfnAuthorizer,
    Cors,
    LambdaIntegration,
    Resource,
    RestApi
} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {PolicyDocument, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";
import {commonLambdaProps} from './constants';

export class SommelierAiCdkStack extends Stack {
    private authoriserLogicalId: string;

    constructor(scope: Construct, id: string, props?: StackProps, envs?: Environment) {
        super(scope, id, props);

        if (!envs) throw Error('Missing envs param');

        const bucket = new Bucket(this, 'SommelierAi_Bucket', {
            bucketName: envs.BUCKET_NAME,
        });

        const wineListDb = new Table(this, 'SommelierAi_WineListDb', {
            partitionKey: {name: 'userId', type: AttributeType.STRING},
            sortKey: {name: 'sk', type: AttributeType.STRING},
            readCapacity: 3,
            writeCapacity: 2,
        });

        // wineListDb.addLocalSecondaryIndex({
        //     indexName: 'statusKey',
        //     sortKey: {name: 'status', type: AttributeType.NUMBER} // enum 1=published, 0=unpublished (other numbers could be used for draft etc.)
        // });

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

        const usagePlan = api.addUsagePlan('SommelierAi_UsagePlan', {
            name: 'General Usage Plan',
            throttle: {
                burstLimit: 50,
                rateLimit: 25,
            },
        });

        api.addApiKey('BaseApiKey', {apiKeyName: 'SommelierAi_BaseApiKey'})
        usagePlan.addApiKey(new ApiKey(this, 'ApiKey', {apiKeyName: 'SommelierAi_UsageApiKey'}));

        const authorizerHandler = new NodejsFunction(this, 'SommelierAi_CustomAuthorizer', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/auth/auth0-authoriser.ts',
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

        this.authoriserLogicalId = authorizer.logicalId;

        const chatHandler = new NodejsFunction(this, 'SommelierAi_OpenAiChatTastingNotesLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/openai-queries/chat.ts',
            timeout: Duration.seconds(29),
            memorySize: 512,
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY
            }
        });
        const chatResource = api.root.addResource('chat');
        this.addAuthMethod('post', chatResource, chatHandler);

        const recommendationsHandler = new NodejsFunction(this, 'SommelierAi_OpenAiRecommendationsLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/openai-queries/recommendations.ts',
            timeout: Duration.seconds(12),
            memorySize: 2048,
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY,
                BUCKET_NAME: envs.BUCKET_NAME
            },
        });
        const recommendationsResource = api.root.addResource('recommendations');
        this.addAuthMethod('post', recommendationsResource, recommendationsHandler);
        bucket.grantRead(recommendationsHandler);

        const createWineHandler = new NodejsFunction(this, 'SommelierAi_CreateWineLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/create-wine.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const updateWineHandler = new NodejsFunction(this, 'SommelierAi_UpdateWineLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/update-wine.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const deleteWineHandler = new NodejsFunction(this, 'SommelierAi_DeleteWineLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/delete-wine.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const getWineHandler = new NodejsFunction(this, 'SommelierAi_GetWineLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/get-wine.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const getWineListHandler = new NodejsFunction(this, 'SommelierAi_GetWineListLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/get-wine-list.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const addTastingNoteHandler = new NodejsFunction(this, 'SommelierAi_AddTastingNoteLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/add-tasting-note.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION,
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY,
            }
        });

        const selectTastingNoteHandler = new NodejsFunction(this, 'SommelierAi_SelectTastingNoteLambda', {
            ...commonLambdaProps,
            entry: 'lambda/handlers/wine-list/select-tasting-note.ts',
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION,
            }
        });

        const wineListResource = api.root.addResource('wine-list');
        const wineItemResource = wineListResource.addResource('{sk}');
        this.addAuthMethod('get', wineListResource, getWineListHandler);
        this.addAuthMethod('post', wineListResource, createWineHandler);
        this.addAuthMethod('get', wineItemResource, getWineHandler);
        this.addAuthMethod('put', wineItemResource, updateWineHandler);
        this.addAuthMethod('delete', wineItemResource, deleteWineHandler);

        const tastingNoteResource = wineListResource.addResource('tasting-note');
        this.addAuthMethod('put', tastingNoteResource, addTastingNoteHandler);

        const tastingNoteSelectResource = wineListResource.addResource('select-tasting-note');
        this.addAuthMethod('put', tastingNoteSelectResource, selectTastingNoteHandler);

        wineListDb.grantReadWriteData(createWineHandler);
        wineListDb.grantReadWriteData(updateWineHandler);
        wineListDb.grantReadWriteData(deleteWineHandler);
        wineListDb.grantReadWriteData(addTastingNoteHandler);
        wineListDb.grantReadWriteData(selectTastingNoteHandler);
        wineListDb.grantReadData(getWineHandler);
        wineListDb.grantReadData(getWineListHandler);
    }

    private addAuthMethod(method: string, resource: Resource, handler: NodejsFunction) {
        const route = resource.addMethod(
            method,
            new LambdaIntegration(handler),
            {
                authorizationType: AuthorizationType.CUSTOM,
            }
        );
        const childResource = route.node.findChild('Resource');

        (childResource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (childResource as CfnResource).addPropertyOverride('AuthorizerId', {Ref: this.authoriserLogicalId});
    }
}

