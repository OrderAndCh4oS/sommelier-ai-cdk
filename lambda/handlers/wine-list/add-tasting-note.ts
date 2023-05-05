import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import {UpdateCommand, UpdateCommandInput} from '@aws-sdk/lib-dynamodb';
import getDocumentClient from '../utilities/get-document-client';
import Joi from 'joi';
import {nanoid} from "nanoid";

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
        if (!userId) return jsonResponse({error: 'NOT_AUTHENTICATED'}, 401);
        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);
        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        if (error) return jsonResponse(error, 400);
        // const {searchEmbedding, similarityEmbedding} = await getEmbeddings(body.text);
        // Todo: store the embedding somewhere
        const params: UpdateCommandInput = {
            TableName,
            Key: {
                userId,
                sk: `${body.wineSk}`,
            },
            UpdateExpression: 'set #tastingNotes = list_append(if_not_exists(#tastingNotes, :empty_list), :tastingNote)',
            ExpressionAttributeNames: {
                '#tastingNotes': 'tastingNotes'
            },
            ExpressionAttributeValues: {
                ':tastingNote': [{id: `NOTE#${nanoid()}`, text: body.text}],
                ':empty_list': []
            }
        };
        await docClient.send(new UpdateCommand(params));
        return {
            statusCode: 200,
            body: ''
        }
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
