import axios from 'axios';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Handler} from 'aws-lambda';
import {parse} from 'papaparse';

import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3"
import jsonResponse from "../utilities/json-response";

if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');
if (!process.env.BUCKET_NAME) throw new Error('Missing BUCKET_NAME');

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME;

const client = new S3Client({
    maxAttempts: 3
});
const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: 'wine_tasting_notes_embeddings__curie_combined.csv'
});

interface CsvData {
    '0': string,
    curie_similarity: number[],
    curie_search: number[]
}

let data: CsvData[] | null = null;

const streamToString = (stream: any) => new Promise<string>((resolve, reject) => {
    const chunks: any = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

async function getEmbeddings(input: string, model: string) {
    return await axios.post(
        OPEN_AI_API_URL + '/embeddings',
        JSON.stringify({model, input}),
        {
            headers: {
                Authorization: `Bearer ${OPEN_AI_API_KEY}`,
                'Content-Type': 'application/json'
            },
        }
    );
}

const cosineSimilarity = (a: number[], b: number[]) => {
    if (a.length !== b.length) throw new Error('Vectors are not equal');
    let mA = 0, mB = 0, p = 0;
    for (let i = 0; i < a.length; i++) {
        const aI = a[i];
        const bI = b[i];
        mA += aI * aI;
        mB += bI * bI;
        p += aI * bI;
    }

    return p / (Math.sqrt(mA) * Math.sqrt(mB));
};

const populateBestMatches = (
    embeddingA: number[],
    embeddingB: number[],
    closest: { value: number; index: number }[],
    n: number,
    i: number
) => {
    const similarity = cosineSimilarity(embeddingA, embeddingB);
    const min = Math.min(...closest.map(x => x.value));

    if (closest.length < n || similarity > min) {
        if (closest.length === n) {
            const index = closest.findIndex(x => x.value === min);
            if (index !== -1) closest.splice(index, 1);
        }
        closest.push({value: similarity, index: i});
    }
};

export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
    try {
        if (!data) {
            const embeddingsObject = await client.send(command);
            if (!embeddingsObject?.Body) {
                return jsonResponse({error: 'DATA_REQUEST_ERROR'}, 500);
            }
            const embeddingsCsv = await streamToString(embeddingsObject.Body);
            data = (parse<CsvData>(embeddingsCsv, {
                header: true,
                transform: (value, column) => {
                    if (column === '0') return value;
                    return JSON.parse(value);
                }
            }))?.data || null;
        }

        const body = JSON.parse(event?.body || '') as {query?: string};
        const query = body.query
        if (!query) return jsonResponse({error: 'MISSING_QUERY'}, 400);

        const response = await Promise.all([
            getEmbeddings(query, 'text-similarity-curie-001'),
            getEmbeddings(query, 'text-search-curie-query-001'),
        ]);

        if (response[0].status !== 200 || response[1].status !== 200) {
            return jsonResponse({error: 'AI_REQUEST_ERROR'}, 500)

        }

        const similarityEmbedding: number[] = response[0].data?.data?.[0].embedding;
        const searchEmbedding: number[] = response[1].data?.data?.[0].embedding;

        if (!similarityEmbedding || !searchEmbedding) {
            return jsonResponse({error: 'AI_SIMILARITY_ERROR'}, 500)
        }

        const n = 3;

        const bestMatchRecommend: { value: number, index: number }[] = [];
        const bestMatchSearch: { value: number, index: number }[] = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            if (!row?.curie_search || !row.curie_similarity) break;

            populateBestMatches(row.curie_similarity, similarityEmbedding, bestMatchRecommend, n, i);
            populateBestMatches(row.curie_search, searchEmbedding, bestMatchSearch, n, i);
        }

        if (bestMatchRecommend.length < n || bestMatchSearch.length < n) {
            return jsonResponse({error: 'FAILED_TO_RETRIEVE_N_RESULTS'}, 500)
        }

        const result = {
            search: bestMatchSearch.map(x => data![x.index]['0']),
            recommend: bestMatchRecommend.map(x => data![x.index]['0']),
        }

        return jsonResponse(result)
    } catch (e) {
        console.log(e)
        return jsonResponse({error: 'REQUEST_FAILURE'}, 500);
    }
};
