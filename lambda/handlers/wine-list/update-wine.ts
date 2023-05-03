import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import {GetCommand, PutCommand, PutCommandInput} from '@aws-sdk/lib-dynamodb';
import jsonResponse from '../utilities/json-response';
import getDocumentClient from '../utilities/get-document-client';
import Joi from 'joi';

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient();

// Todo: improve validation
const schema = Joi.object({
    sk: Joi.string().required(),
    name: Joi.string().required(),
    style: Joi.string().required(),
    country: Joi.string().required(),
    region: Joi.string().required(),
    vineyard: Joi.string().required(),
    vintage: Joi.number().min(1800).max(new Date().getFullYear() + 1).required(),
    score: Joi.number().required(),
    flavourProfile: Joi.array().items(Joi.string()).required(),
});

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        console.log(event.body);
        // Todo: userId should match current authed userId (for now, later same organisation and permissions)
        const userId = event?.requestContext?.authorizer?.principalId;
        if(!userId) return jsonResponse({error: 'NOT_AUTHENTICATED'}, 401);
        const {sk} = event.pathParameters as { userId: string, sk: string };
        const command = new GetCommand({
            TableName,
            Key: {
                userId: decodeURIComponent(userId),
                sk: decodeURIComponent(sk)
            }
        });
        console.log("DECODED_SK", decodeURIComponent(sk))
        const response = await docClient.send(command);
        if (!response?.Item) return jsonResponse('', 404);

        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);

        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        if (error) return jsonResponse(error, 400);

        const params: PutCommandInput = {
            TableName,
            Item: {
                ...response.Item,
                userId,
                sk: decodeURIComponent(sk), // Todo: should this use body or path param?
                name: body.name,
                style: body.style,
                country: body.country,
                region: body.region,
                vintage: body.vintage,
                vineyard: body.vineyard,
                score: body.score,
                tastingNote: body.tastingNote,
                flavourProfile: body.flavourProfile,
                updatedAt: (new Date()).toISOString(),
            },
        };

        await docClient.send(new PutCommand(params));
        return jsonResponse(params.Item);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
