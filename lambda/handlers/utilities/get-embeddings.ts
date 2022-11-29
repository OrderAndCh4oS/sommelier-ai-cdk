import axios from 'axios';

const OPEN_AI_API_URL = process.env.OPEN_AI_API_URL;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
if (!process.env.OPEN_AI_API_URL) throw new Error('Missing OPEN_AI_API_URL');
if (!process.env.OPEN_AI_API_KEY) throw new Error('Missing OPEN_AI_API_KEY');

class AiRequestError extends Error {
    constructor() {
        super('AI_REQUEST_ERROR');
    }
}

class AiEmbeddingError extends Error {
    constructor() {
        super('AI_EMBEDDING_ERROR');
    }
}

async function fetchEmbeddings(input: string, model: string) {
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

export default async function getEmbeddings(text: string) {
    const response = await Promise.all([
        fetchEmbeddings(text, 'text-similarity-curie-001'),
        fetchEmbeddings(text, 'text-search-curie-query-001'),
    ]);

    if (response[0].status !== 200 || response[1].status !== 200) {
        throw new AiRequestError()
    }

    const similarityEmbedding: number[] = response[0].data?.data?.[0].embedding;
    const searchEmbedding: number[] = response[1].data?.data?.[0].embedding;

    if (!similarityEmbedding || !searchEmbedding) {
        throw new AiEmbeddingError()
    }

    return {searchEmbedding, similarityEmbedding}
}
