FROM public.ecr.aws/lambda/python:3.8

WORKDIR ${LAMBDA_TASK_ROOT}

# copy all python files to lamda working directory
COPY main.py .
COPY wine_tasting_notes_embeddings__curie_combined.csv .

# Copy requirements.txt to lamda working directory
COPY requirements.txt .
RUN pip3 install -r requirements.txt

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "main.handler" ]
