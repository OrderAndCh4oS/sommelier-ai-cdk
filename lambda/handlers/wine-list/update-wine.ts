import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";
import {GetCommand, PutCommand, PutCommandInput} from "@aws-sdk/lib-dynamodb";
import jsonResponse from "../utilities/json-response";
import getDocumentClient from "../utilities/get-document-client";
import Joi from "joi";

if (!process.env.TABLE_NAME) throw new Error('Missing TABLE_NAME');
const TableName = process.env.TABLE_NAME;

const docClient = getDocumentClient();

// Todo: improve validation
const schema = Joi.object({
    userId: Joi.string().required(), // Todo: replace with organisationId later, add createdBy field for userId
    sk: Joi.string().required(),
    name: Joi.string().required(),
    style: Joi.string().required(),
    country: Joi.string().required(),
    region: Joi.string().required(), // Todo: Just a name for now, can be a relation with more context details
    vineyard: Joi.string().required(), // Todo: Just a name for now, can be a relation with more context details
    vintage: Joi.number().min(1800).max(new Date().getFullYear() + 1).required(),
    score: Joi.number().required(),
    flavourProfile: Joi.array().items(Joi.string()).required(),
    detailPrompt: Joi.string().required(),
    starterText: Joi.string().required(), // Todo: Make optional, generate full text if not present
    tastingNote: Joi.string().required()
});

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        console.log(event.body);
        // Todo: userId should match current authed userId (for now, later same organisation and permissions)
        const {userId, sk} = event.pathParameters as { userId: string, sk: string };
        const command = new GetCommand({
            TableName,
            Key: {
                userId,
                sk
            }
        });

        console.log(userId, sk);

        const response = await docClient.send(command);
        if(!response?.Item) return jsonResponse('', 404);

        if (!event.body) return jsonResponse({error: "MISSING_REQUEST_BODY"}, 400);

        const body = JSON.parse(event.body as string);
        const {error} = schema.validate(body);
        console.log('Validation Error:', error);
        if (error) return jsonResponse(error, 400);

        // Todo: get new embedding for updated tasting notes
        const params: PutCommandInput = {
            TableName,
            Item: {
                userId,
                sk,
                name: body.name,
                style: body.style,
                country: body.country,
                region: body.region,
                vintage: body.vintage,
                vineyard: body.vineyard,
                score: body.score,
                tastingNote: body.tastingNote,
                flavourProfile: body.flavourProfile,
                detailPrompt: body.detailPrompt,
                starterText: body.starterText,
                updatedAt: (new Date()).toISOString(),
                createdAt: response?.Item.createdAt
            },
        };
        console.log('params', params)
        await docClient.send(new PutCommand(params));
        return jsonResponse(params.Item);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
