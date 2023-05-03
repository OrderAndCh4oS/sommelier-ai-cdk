import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import {PutCommand, PutCommandInput} from '@aws-sdk/lib-dynamodb';
import getDocumentClient from '../utilities/get-document-client';
import Joi from 'joi';
import {nanoid} from 'nanoid';
import getEmbeddings from '../utilities/get-embeddings';

const TableName = process.env.TABLE_NAME;
if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');

const docClient = getDocumentClient();

// Todo: improve validation
const schema = Joi.object({
    text: Joi.string().required(),
    wineSk: Joi.string().required(),
});

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        console.log(event.body);
        const userId = event?.requestContext?.authorizer?.principalId;
        if(!userId) return jsonResponse({error: 'NOT_AUTHENTICATED'}, 401);
        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);
        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        if (error) return jsonResponse(error, 400);
        const {searchEmbedding, similarityEmbedding} = await getEmbeddings(body.text);
        const params: PutCommandInput = {
            TableName,
            Item: {
                userId,
                sk: `${body.wineSk}_NOTE#${nanoid()}`,
                text: body.text,
                searchEmbedding,
                similarityEmbedding,
                createdAt: (new Date()).toISOString(),
                updatedAt: (new Date()).toISOString()
            },
        };
        await docClient.send(new PutCommand(params));
        return jsonResponse(params.Item);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
