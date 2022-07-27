import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import pkg from 'papaparse';
const {parse} = pkg;

const client = new S3Client({
    maxAttempts: 3
});
const command = new GetObjectCommand({
    Bucket: 'sommelier-ai',
    Key: 'wine_tasting_notes_embeddings__curie_combined.csv'
});

console.log('GETTING OBJECT');

const embeddingsObject = await client.send(command);

console.log('GOT OBJECT');
if(!embeddingsObject?.Body) {
console.log('NO BODY')
}
console.log('PARSED OBJECT');

const streamToString = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

const embeddingsCsv = await streamToString(embeddingsObject.Body);
// console.log(embeddingsCsv);
console.log('GOT EMBEDDINGS CSV');
const data = parse(embeddingsCsv, {
    header: true,
    transform: (value, column) => {
        if(column === '0') return value;
        return JSON.parse(value);
    }
});
console.log('GOT EMBEDDINGS DATA');
console.log(data);
