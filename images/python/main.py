#!/usr/bin/env python3
import os

import boto3

import json
import requests


import numpy as np
import pandas as pd
import openai
from openai.embeddings_utils import (
    get_embedding,
    distances_from_embeddings,
    indices_of_nearest_neighbors_from_distances,
    cosine_similarity
)
from io import StringIO

openai.api_key = os.getenv('OPEN_AI_API_KEY')
bucket_name = os.getenv('BUCKET_NAME')
data_csv = os.getenv('DATA_CSV')

s3_client = boto3.client("s3")

file = s3_client.get_object(
    Bucket=bucket_name,
    Key="wine_tasting_notes_embeddings__curie_combined.csv"
)["Body"]

df = pd.read_csv(file)
df['curie_similarity'] = df.curie_similarity.apply(eval).apply(np.array)
df['curie_search'] = df.curie_search.apply(eval).apply(np.array)

def search_reviews(df, query, n=3):
    embedding = get_embedding(query, engine='text-search-curie-query-001')
    df['similarities'] = df.curie_search.apply(lambda x: cosine_similarity(x, embedding))
    res = df.sort_values('similarities', ascending=False).head(n)
    return res['0'].to_list()


def recommendations_from_strings(df, query, n=3):
    embedding = get_embedding(query, engine='text-similarity-curie-001')
    distances = distances_from_embeddings(embedding, df.curie_similarity, distance_metric="cosine")
    indices_of_nearest_neighbors = indices_of_nearest_neighbors_from_distances(distances)
    result = []
    for i in indices_of_nearest_neighbors[:n]:
        result.append(df['0'][i])

    return result

def get_recommendations(query):
    search = search_reviews(df, query, n=3)
    recommend = recommendations_from_strings(df, query, n=3)

    return {"search": search, "recommend": recommend}

def handler(event, context):
    print("{}".format(event))
    try:
        body = json.loads(event["body"])

        if('query' not in body):
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "MISSING_QUERY"})
            }

        recommendations = get_recommendations(body['query'])

        return {
           "statusCode": 200,
           "headers": {"Content-Type": "application/json"},
           "body": json.dumps(recommendations)
       }
    except:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "UNKNOWN_ERROR"})
        }

