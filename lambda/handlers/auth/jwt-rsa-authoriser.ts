import {config} from 'dotenv';
import jwksClient from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import util from 'util';

if (!process.env.AUTH0_AUDIENCE) throw new Error('Missing AUTH0_AUDIENCE');
if (!process.env.AUTH0_ISSUER) throw new Error('Missing AUTH0_ISSUER');
if (!process.env.REGION) throw new Error('Missing REGION');
if (!process.env.ACCOUNT) throw new Error('Missing ACCOUNT');

const AUTH0_JWKS_URI = `${process.env.AUTH0_ISSUER}.well-known/jwks.json`

config();

const getPolicyDocument = (effect: any, resource: any) => {
    return {
        Version: '2012-10-17', // default version
        Statement: [{
            Action: 'execute-api:Invoke', // default action
            Effect: effect,
            Resource: resource,
        }]
    };
}

const getToken = (params: any) => {
    if (!params.type || params.type !== 'TOKEN') {
        throw new Error('Expected "event.type" parameter to have value "TOKEN"');
    }

    const tokenString = params.authorizationToken;
    if (!tokenString) {
        throw new Error('Expected "event.authorizationToken" parameter to be set');
    }

    const match = tokenString.match(/^Bearer (.*)$/);
    if (!match || match.length < 2) {
        throw new Error(`Invalid Authorization token - ${tokenString} does not match "Bearer .*"`);
    }
    return match[1];
}

const jwtOptions = {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_ISSUER
};

const client = jwksClient({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
    jwksUri: AUTH0_JWKS_URI
});

const authenticate = (params: any) => {
    const token = getToken(params);

    const decoded = jwt.decode(token, {complete: true});
    if (!decoded || !decoded.header || !decoded.header.kid) {
        throw new Error('invalid token');
    }

    const getSigningKey = util.promisify(client.getSigningKey);
    return getSigningKey(decoded.header.kid)
        .then((key: any) => {
            const signingKey = key?.publicKey || key?.rsaPublicKey;
            return jwt.verify(token, signingKey, jwtOptions);
        })
        .then((decoded: any) => ({
            principalId: decoded.sub,
            // policyDocument: getPolicyDocument('Allow', params.methodArn),
            policyDocument: getPolicyDocument('Allow', '*'),
            context: {scope: decoded.scope}
        }));
}

export default authenticate
