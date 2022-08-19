import axios from "axios";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";
import jsonResponse from "../utilities/json-response";

if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

const getPrompt = (tastingNotes: string) => `REIMAGINE AND EMBELLISH the following TASTING NOTE using creative language

TASTING NOTE: ${tastingNotes.trim()}

REIMAGINE AND EMBELLISH:`;

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    console.log(event.body);

    const body = JSON.parse(event?.body || '') as {tastingNotes?: string};
    const tastingNotes = body.tastingNotes;
    if (!tastingNotes) return jsonResponse({error: 'MISSING_TASTING_NOTES'}, 400);

    try {
        const response = await axios.post(
            OPEN_AI_API_URL + '/completions',
            JSON.stringify({
                model: "text-davinci-002",
                prompt: getPrompt(tastingNotes),
                temperature: 0.9,
                max_tokens: 128,
                top_p: 1,
                frequency_penalty: 1.75,
                presence_penalty: 0,
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
