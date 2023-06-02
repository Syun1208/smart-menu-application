FROM rasa/rasa:3.5.10-full

USER root

WORKDIR /app

COPY . .

RUN pip3 install -r requirements.txt