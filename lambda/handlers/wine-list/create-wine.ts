import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import {PutCommand, PutCommandInput} from '@aws-sdk/lib-dynamodb';
import getDocumentClient from '../utilities/get-document-client';
import {nanoid} from 'nanoid';
import wineSchema from "../../schema/wine";

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient();


export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        const userId = event?.requestContext?.authorizer?.principalId;
        if (!userId) return jsonResponse({error: 'NOT_AUTHENTICATED'}, 401);

        if (!event.body) return jsonResponse({error: 'MISSING_REQUEST_BODY'}, 400);
        const body = JSON.parse(event.body as string);

        const {error} = wineSchema.validate(body);
        if (error) return jsonResponse(error, 400);

        const params: PutCommandInput = {
            TableName,
            Item: {
                userId,
                sk: `WINE#${nanoid()}`,
                name: body.name,
                style: body.style,
                country: body.country,
                region: body.region,
                vintage: body.vintage,
                vineyard: body.vineyard,
                score: body.score,
                flavourProfile: body.flavourProfile,
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
