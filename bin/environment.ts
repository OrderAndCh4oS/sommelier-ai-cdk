import {config} from "dotenv";

config();

export interface Environment {
    STAGE: string,
    DOMAIN_NAME: string,
    REGION: string,
    ACCOUNT: string,
    OPEN_AI_API_KEY: string,
    OPEN_AI_API_URL: string,
}

const envs = {
    STAGE: process.env.STAGE || 'dev',
    DOMAIN_NAME: process.env.DOMAIN_NAME || 'http://localhost:3000',
    REGION: process.env.REGION || 'eu-west-1',
    ACCOUNT: process.env.ACCOUNT || '',
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY || '',
    OPEN_AI_API_URL: process.env.OPEN_AI_API_URL || '',
}

export default envs;
