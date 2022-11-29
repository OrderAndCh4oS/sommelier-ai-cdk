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
    userId: Joi.string().required(), // Todo: replace with organisationId later, add createdBy field for userId
    text: Joi.string().required(),
    wineSk: Joi.string().required(),
});

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        // Todo: userId should match current authed userId (for now, later same organisation and permissions)
        console.log(event.body);
        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);
        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        if (error) return jsonResponse(error, 400);
        const {searchEmbedding, similarityEmbedding} = await getEmbeddings(body.text);
        const params: PutCommandInput = {
            TableName,
            Item: {
                userId: body.userId,
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
