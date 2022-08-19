const jsonResponse = (data: any, statusCode = 200, headers: { [header: string]: boolean | number | string; } = {}) => {
    headers["Content-Type"] = "application/json";
    return {
        statusCode,
        headers,
        body: JSON.stringify(data)
    }
}

export default jsonResponse;
