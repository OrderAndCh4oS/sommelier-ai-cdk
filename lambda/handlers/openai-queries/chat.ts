import axios from 'axios';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import jsonResponse from '../utilities/json-response';
import wineSchema, {IWine} from "../../schema/wine";
import {trimIndents} from "../../utilities/trim-indents";

if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    const userId = event?.requestContext?.authorizer?.principalId;

    const body = JSON.parse(event?.body || '') as { notes?: string, wine?: IWine };
    const notes = body.notes;
    const wine = body.wine;

    if (!notes) return jsonResponse({error: 'MISSING_NOTES'}, 400);
    if (wine) {
        const {error} = wineSchema.validate(wine);
        if (error) return jsonResponse(error, 400);
    }

    const messages = [
        {
            role: "system", content: trimIndents`
                You're an experienced and influential wine critic. 
                You have extensive tasting experience, a refined palate and can communicate the many characteristics of a wine. 
                You write consistent tasting notes which describe the specific features and flavours of a wine. 
                You have deep knowledge of grape varieties and vineyards.

                Some rules to follow:
                Don't output word counts
                Don't name the wine unless it's provided
                Don't make stuff up about countries, regions, grape varieties etc.
                Do use data provided to inform the tasting notes. However, you're not obliged to use all of the details provided in responses
            `
        },
    ];
    if (wine) {
        messages.push(
            {
                role: "user",
                content: trimIndents`
                    Here are some details about the wine we're reviewing:
                    
                    name: ${wine.name}
                    style: ${wine.style}
                    country: ${wine.country}
                    region: ${wine.region}
                    vineyard: ${wine.vineyard}
                    vintage: ${wine.vintage}
                    flavours: ${wine.flavourProfile.join(', ')}
                    
                    Find out what you know about this wine, keep it in mind for the text steps.
                `
            },
        )
    }

    messages.push({role: "user", content: trimIndents`
        Based on any existing knowledge you have of the wine and the following tasting notes write a review for a wine magazine, be sure to keep it under the 100-word limit.
        
        ${notes}
    `})

    try {
        const response = await axios.post(
            OPEN_AI_API_URL + '/chat/completions',
            JSON.stringify({
                model: "gpt-3.5-turbo",
                messages,
                temperature: 0.9,
                top_p: 1,
                frequency_penalty: 1,
                presence_penalty: 0,
                max_tokens: 1024,
                n: 3,
                user: userId
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
