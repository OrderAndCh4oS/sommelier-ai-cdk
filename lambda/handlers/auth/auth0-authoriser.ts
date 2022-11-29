import authenticate from './jwt-rsa-authoriser';

let data;

export const handler = async (event: any, context: any, callback: any) => {
    try {
        data = await authenticate(event);
    } catch (err) {
        console.log(err);
        return context.fail('Unauthorized');
    }
    console.log(data);
    return data;
};


