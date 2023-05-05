import authenticate from './jwt-rsa-authoriser';

let data;

export const handler = async (event: any, context: any) => {
    try {
        data = await authenticate(event);
    } catch (err) {
        return context.fail('Unauthorized');
    }

    return data;
};


