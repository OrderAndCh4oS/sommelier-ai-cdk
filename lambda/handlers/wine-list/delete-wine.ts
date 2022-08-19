import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";
import jsonResponse from "../utilities/json-response";
import getDocumentClient from "../utilities/get-document-client";
import {DeleteCommand} from "@aws-sdk/lib-dynamodb";

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient()

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        const {userId, sk} = event.pathParameters as { userId: string, sk: string };
        const command = new DeleteCommand({
            TableName,
            Key: {
                userId,
                sk
            },
        });
        await docClient.send(command);
        return {
            statusCode: 200,
            body: ''
        }
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
