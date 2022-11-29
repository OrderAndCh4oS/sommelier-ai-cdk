import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import getDocumentClient from '../utilities/get-document-client';
import {QueryCommand} from '@aws-sdk/lib-dynamodb';

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient()

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        const {userId, sk} = event.pathParameters as { userId: string, sk: string };
        const command = new QueryCommand({
            TableName,
            KeyConditionExpression: 'userId = :userId and begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':userId': decodeURIComponent(userId),
                ':sk': decodeURIComponent(sk),
            },
        });
        const response = await docClient.send(command);
        if (!response.Items?.length) return jsonResponse({error: 'NOT_FOUND'}, 404);

        let wine: any = null;
        const tastingNotes: Record<string, Record<string, any>[]> = {};

        for (const item of response.Items) {
            if (!item.sk.includes('NOTE#')) {
                wine = item;
            } else {
                delete item.searchEmbedding
                delete item.similarityEmbedding
                const wineSk = item.sk.slice(0, 26);
                if (!tastingNotes[wineSk]) tastingNotes[wineSk] = []
                tastingNotes[wineSk].push(item);
            }
        }

        wine.tastingNote = wine.sk ? tastingNotes[wine.sk] : null

        return jsonResponse(wine);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
