FROM public.ecr.aws/lambda/python:3.8

WORKDIR ${LAMBDA_TASK_ROOT}

COPY main.py .

COPY requirements.txt .
RUN pip3 install -r requirements.txt

CMD [ "main.handler" ]
