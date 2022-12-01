import {CfnResource, Duration, Stack, StackProps} from 'aws-cdk-lib';

import {Construct} from 'constructs';
import {AuthorizationType, CfnAuthorizer, Cors, LambdaIntegration, Resource, RestApi} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {PolicyDocument, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {AttributeType, Table} from "aws-cdk-lib/aws-dynamodb";

export class SommelierAiCdkStack extends Stack {
    private authoriserLogicalId: string;

    constructor(scope: Construct, id: string, props?: StackProps, envs?: Environment) {
        super(scope, id, props);

        if (!envs) throw Error('Missing envs param');

        const bucket = new Bucket(this, 'SommelierAi_Bucket', {
            bucketName: envs.BUCKET_NAME,
        });

        /**
         * pk: userId
         * wineSk: wineNameSlug_shortUuid
         * tastingNoteSk: wineNameSk_shortUuid
         * wineData: style, country, region, vintage, name, score, tastingNote, embedding, status
         * tastingNoteData: text, searchVector, similarityVector, isActive, createdAt, updatedAt
         */
        const wineListDb = new Table(this, 'SommelierAi_WineListDb', {
            partitionKey: {name: 'userId', type: AttributeType.STRING},
            sortKey: {name: 'sk', type: AttributeType.STRING}
        });

        wineListDb.addLocalSecondaryIndex({
            indexName: 'statusKey',
            sortKey: {name: 'status', type: AttributeType.NUMBER} // enum 1=published, 0=unpublished (other numbers could be used for draft etc.)
        });

        wineListDb.addLocalSecondaryIndex({
            indexName: 'tastingNote',
            sortKey: {name: 'tastingNoteSk', type: AttributeType.STRING} // enum 1=published, 0=unpublished (other numbers could be used for draft etc.)
        });

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

        const completionHandler = new NodejsFunction(this, 'SommelierAi_OpenAiTastingNotesLambda', {
            entry: 'lambda/handlers/openai-queries/completion.ts',
            timeout: Duration.seconds(12),
            memorySize: 512,
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY
            }
        });
        const completionResource = api.root.addResource('completion');
        this.addAuthMethod('post', completionResource, completionHandler);

        const editHandler = new NodejsFunction(this, 'SommelierAi_OpenAiEditLambda', {
            entry: 'lambda/handlers/openai-queries/edit.ts',
            timeout: Duration.seconds(12),
            memorySize: 512,
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY
            }
        });
        const editResource = api.root.addResource('edit');
        this.addAuthMethod('post', editResource, editHandler);

        const recommendationsHandler = new NodejsFunction(this, 'SommelierAi_OpenAiRecommendationsLambda', {
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
            entry: 'lambda/handlers/wine-list/create-wine.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const updateWineHandler = new NodejsFunction(this, 'SommelierAi_UpdateWineLambda', {
            entry: 'lambda/handlers/wine-list/update-wine.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const deleteWineHandler = new NodejsFunction(this, 'SommelierAi_DeleteWineLambda', {
            entry: 'lambda/handlers/wine-list/delete-wine.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const getWineHandler = new NodejsFunction(this, 'SommelierAi_GetWineLambda', {
            entry: 'lambda/handlers/wine-list/get-wine.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const getWineListHandler = new NodejsFunction(this, 'SommelierAi_GetWineListLambda', {
            entry: 'lambda/handlers/wine-list/get-wine-list.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION
            }
        });

        const addTastingNoteHandler = new NodejsFunction(this, 'SommelierAi_AddTastingNoteLambda', {
            entry: 'lambda/handlers/wine-list/add-tasting-note.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION,
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY,
            }
        });

        const selectTastingNoteHandler = new NodejsFunction(this, 'SommelierAi_SelectTastingNoteLambda', {
            entry: 'lambda/handlers/wine-list/select-tasting-note.ts',
            timeout: Duration.seconds(3),
            memorySize: 256,
            environment: {
                TABLE_NAME: wineListDb.tableName,
                REGION: envs.REGION,
            }
        });

        const wineListResource = api.root.addResource('wine-list');
        const wineListByUserResource = wineListResource.addResource('{userId}');
        const wineItemResource = wineListByUserResource.addResource('{sk}');
        wineListByUserResource.addMethod('get', new LambdaIntegration(getWineListHandler));
        wineItemResource.addMethod('get', new LambdaIntegration(getWineHandler));
        this.addAuthMethod('post', wineListResource, createWineHandler);
        this.addAuthMethod('put', wineItemResource, updateWineHandler);
        this.addAuthMethod('delete', wineItemResource, deleteWineHandler);

        const tastingNoteResource = wineListByUserResource.addResource('tasting-note');
        this.addAuthMethod('put', tastingNoteResource, addTastingNoteHandler);

        const tastingNoteSelectResource = wineListByUserResource.addResource('select-tasting-note');
        this.addAuthMethod('put', tastingNoteSelectResource, selectTastingNoteHandler);

        wineListDb.grantReadWriteData(createWineHandler);
        wineListDb.grantReadWriteData(updateWineHandler);
        wineListDb.grantReadWriteData(deleteWineHandler);
        wineListDb.grantReadWriteData(addTastingNoteHandler);
        wineListDb.grantReadWriteData(selectTastingNoteHandler);
        wineListDb.grantReadData(getWineHandler);
        wineListDb.grantReadData(getWineListHandler);
    }

    private addAuthMethod(method: string, resource: Resource, editHandler: NodejsFunction) {
        const route = resource.addMethod(
            method,
            new LambdaIntegration(editHandler),
            {
                authorizationType: AuthorizationType.CUSTOM,
            }
        );
        const childResource = route.node.findChild('Resource');

        (childResource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (childResource as CfnResource).addPropertyOverride('AuthorizerId', {Ref: this.authoriserLogicalId});
    }
}

