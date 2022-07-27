import {config} from "dotenv";
import * as process from "process";

config();

export interface Environment {
    STAGE: string,
    DOMAIN_NAMES: string[],
    REGION: string,
    ACCOUNT: string,
    OPEN_AI_API_KEY: string,
    OPEN_AI_API_URL: string,
    BUCKET_NAME: string,
    DATA_CSV: string
}

const envs = {
    STAGE: process.env.STAGE || 'dev',
    DOMAIN_NAMES: process.env.DOMAIN_NAMES?.split(',') || ['http://localhost:3000'],
    REGION: process.env.REGION || 'eu-west-1',
    ACCOUNT: process.env.ACCOUNT || '',
    BUCKET_NAME: process.env.BUCKET_NAME || '',
    OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY || '',
    OPEN_AI_API_URL: process.env.OPEN_AI_API_URL || '',
    DATA_CSV: process.env.DATA_CSV || ''
}

export default envs;
