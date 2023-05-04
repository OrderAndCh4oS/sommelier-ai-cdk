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
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':userId': userId
            }
        });
        const response = await docClient.send(command);
        if(!response.Items?.length) {
            return jsonResponse({error: 'NOT_FOUND'}, 404);
        }
        const wines = [];
        const tastingNotes: Record<string, Record<string, any>> = {};

        for(const item of response.Items) {
            console.log(item.sk, item.sk.includes('NOTE#'))
            if(!item.sk.includes('NOTE#')) {
                wines.push(item)
            } else {
                tastingNotes[item.sk] = item.text;
            }
        }

        for(const wine of wines) {
            wine.tastingNote = wine.tastingNoteSk ? tastingNotes[wine.tastingNoteSk] : null
        }

        return jsonResponse(wines);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
