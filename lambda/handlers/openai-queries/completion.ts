import axios from 'axios';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';

if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

// const models = [
//     'davinci:ft-orderandchaos-2022-07-24-14-52-09',
//     'davinci:ft-orderandchaos-2022-10-16-11-47-34',
//     'davinci:ft-orderandchaos-2022-10-16-13-55-45'
// ]

// Note: openai api fine_tunes.follow -i ft-DjI1nF14GecOdUtsxJyDfzum
export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    console.log(event.body);

    const body = JSON.parse(event?.body || '') as { prompt?: string };
    const prompt = body.prompt
    if (!prompt) return jsonResponse({error: 'MISSING_PROMPT'}, 400);

    try {
        const response = await axios.post(
            OPEN_AI_API_URL + '/completions',
            JSON.stringify({
                model: 'davinci:ft-orderandchaos-2022-10-16-15-57-43',
                prompt,
                temperature: 0.9,
                max_tokens: 80,
                top_p: 1,
                frequency_penalty: 1,
                presence_penalty: 0,
                n: 3
            }),
            {
                headers: {
                    Authorization: `Bearer ${OPEN_AI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
            }
        );

        return response.status === 200
            ? jsonResponse(response.data)
            : jsonResponse({error: 'REQUEST_ERROR'}, 500);
    } catch (e) {
        console.log(e);
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
