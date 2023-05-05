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
        const {sk} = event.pathParameters as {sk: string };
        console.log('SK', sk)
        console.log('SK_DECODE', decodeURIComponent(sk))
        const command = new QueryCommand({
            TableName,
            KeyConditionExpression: 'userId = :userId and sk = :sk',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':sk': decodeURIComponent(sk),
            },
        });
        const response = await docClient.send(command);
        if (!response.Items?.length) return jsonResponse({error: 'NOT_FOUND'}, 404);

        return jsonResponse(response.Items[0]);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
