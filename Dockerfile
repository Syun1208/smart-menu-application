FROM rasa/rasa:3.5.10-full
FROM python:3.7.2
FROM ubuntu:20.04

USER root

WORKDIR /app

RUN apt-get update && apt-get install -y python3-pip

# RUN pip install --upgrade pip

COPY . .

RUN pip3 install -r requirements.txt

RUN pip3 install rasa && \
    pip3 install rasa[full] && \
    pip3 install rasa[transformers] && \
    pip install transformers && \
    python3 -m spacy download en_core_web_md