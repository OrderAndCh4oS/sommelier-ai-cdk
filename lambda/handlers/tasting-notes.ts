import axios from "axios";
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from "aws-lambda";

if(!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if(!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    console.log(event.body);

    const body = JSON.parse(event?.body || '') as {
        prompt?: string
    };

    const prompt = body.prompt
    if(!prompt) return {statusCode: 400, body: JSON.stringify({error: 'MISSING_PROMPT'})};

    try {
        const response = await axios.post(
            OPEN_AI_API_URL + '/completions',
            JSON.stringify({
                model: "davinci:ft-orderandchaos-2022-07-24-14-52-09",
                prompt,
                temperature: 0.9,
                max_tokens: 70,
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
            ? {statusCode: 200, body: JSON.stringify(response.data)}
            : {statusCode: 500, body: JSON.stringify({error: 'REQUEST_ERROR'})};
    } catch {
        return {statusCode: 500, body: JSON.stringify({error: 'REQUEST_FAILURE'})};
    }
};
