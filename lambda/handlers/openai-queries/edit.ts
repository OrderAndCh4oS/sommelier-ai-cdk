import axios from "axios";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";
import jsonResponse from "../utilities/json-response";

if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    console.log(event.body);

    const body = JSON.parse(event?.body || '') as {input?: string, instruction?: string};
    const input = body.input;
    const instruction = body.instruction;
    if (!input) return jsonResponse({error: 'MISSING_PROMPT'}, 400);

    try {
        const response = await axios.post(
            OPEN_AI_API_URL + '/edits',
            JSON.stringify({
                model: "text-davinci-edit-001",
                input,
                instruction,
                temperature: 0.9,
                top_p: 1,
                n: 3
            }),
            {
                headers: {
                    Authorization: `Bearer ${OPEN_AI_API_KEY}`,
                    "Content-Type": "application/json"
                },
            }
        );

        return response.status === 200
            ? jsonResponse(response.data)
            : jsonResponse({error: 'REQUEST_ERROR'}, 500);
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
