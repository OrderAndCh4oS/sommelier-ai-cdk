import {CfnResource, Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {AuthorizationType, LambdaIntegration, RestApi, CfnAuthorizer} from "aws-cdk-lib/aws-apigateway";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {PolicyDocument, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {Environment} from "../bin/environment";

export class SommelierAiCdkStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps, envs?: Environment) {
        super(scope, id, props);

        if(!envs) throw Error('Missing envs param')

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

        const api = new RestApi(this, 'SommelierAi_Api', {});

        const authorizerHandler = new NodejsFunction(this, 'SommelierAi_CustomAuthorizer', {
            entry: 'lambda/handlers/auth0-authoriser.ts',
            environment: {
                AUTH0_ISSUER: 'https://gpt-3-auth.eu.auth0.com/',
                AUTH0_AUDIENCE: 'https://gpt-3-demo.com'
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

        const tastingNotesHandler = new NodejsFunction(this, 'SommelierAiCustom_TastingNotes', {
            entry: 'lambda/handlers/tasting-notes.ts',
            timeout: Duration.seconds(6),
            environment: {
                OPEN_AI_API_URL: envs.OPEN_AI_API_URL,
                OPEN_AI_API_KEY: envs.OPEN_AI_API_KEY
            }
        });

        const method = api.root.addMethod(
            'post',
            new LambdaIntegration(tastingNotesHandler),
            {
                authorizationType: AuthorizationType.CUSTOM,
            }
        );
        const resource = method.node.findChild('Resource');
        const logicalId = authorizer.logicalId;

        (resource as CfnResource).addPropertyOverride('AuthorizationType', AuthorizationType.CUSTOM);
        (resource as CfnResource).addPropertyOverride('AuthorizerId', { Ref: logicalId });
    }
}

