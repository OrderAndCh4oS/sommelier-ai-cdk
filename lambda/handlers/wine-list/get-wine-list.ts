import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import getDocumentClient from '../utilities/get-document-client';
import {QueryCommand} from '@aws-sdk/lib-dynamodb';

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient()

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        const userId = event?.requestContext?.authorizer?.principalId;
        if(!userId) return jsonResponse({error: 'NOT_AUTHENTICATED'}, 401);
        // Todo: improve this command look up pattern
        const command = new QueryCommand({
            TableName,
            KeyConditionExpression: '#userId = :userId and begins_with(sk, :sk)',
            ExpressionAttributeNames: {
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':userId': userId,
                ':sk': 'WINE'
            }
        });
        const response = await docClient.send(command);
        if(!response.Items?.length) {
            return jsonResponse({error: 'NOT_FOUND'}, 404);
        }

        return jsonResponse(response.Items);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
