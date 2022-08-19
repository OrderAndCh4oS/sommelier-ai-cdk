import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";

if (!process.env.REGION) throw new Error('Missing REGION');
const REGION = process.env.REGION;

const getDocumentClient = () => {
    const dynamoDbClient = new DynamoDBClient({region: REGION});
    return DynamoDBDocumentClient.from(dynamoDbClient);
}

export default getDocumentClient;
