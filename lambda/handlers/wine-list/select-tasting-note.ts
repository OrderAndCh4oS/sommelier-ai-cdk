import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import {UpdateCommand, UpdateCommandInput} from '@aws-sdk/lib-dynamodb';
import getDocumentClient from '../utilities/get-document-client';
import Joi from 'joi';

const TableName = process.env.TABLE_NAME;
if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');

const docClient = getDocumentClient();

// Todo: improve validation
const schema = Joi.object({
    userId: Joi.string().required(), // Todo: replace with organisationId later, add createdBy field for userId
    wineSk: Joi.string().required(),
    tastingNoteSk: Joi.string().required(),
});

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        // Todo: userId should match current authed userId (for now, later same organisation and permissions)
        console.log(event.body);
        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);
        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        if (error) return jsonResponse(error, 400);
        const params: UpdateCommandInput = {
            TableName,
            Key: {
                userId: body.userId,
                sk: body.wineSk,
            },
            UpdateExpression: 'SET #tastingNoteSk = :tastingNoteSk',
            ExpressionAttributeNames: {
                '#tastingNoteSk': 'tastingNoteSk'
            },
            ExpressionAttributeValues: {
                ':tastingNoteSk': body.tastingNoteSk
            },
        };
        await docClient.send(new UpdateCommand(params));
        return {statusCode: 204, body: ''};
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
