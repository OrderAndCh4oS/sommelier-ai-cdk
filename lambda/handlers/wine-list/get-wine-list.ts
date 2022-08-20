import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";
import jsonResponse from "../utilities/json-response";
import getDocumentClient from "../utilities/get-document-client";
import {QueryCommand} from "@aws-sdk/lib-dynamodb";

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient()

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        const {userId} = event.pathParameters as { userId: string };
        const command = new QueryCommand({
            TableName,
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':userId': decodeURI(userId)
            }
        });
        const response = await docClient.send(command);
        return jsonResponse(response.Items)
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
