FROM rasa/rasa:3.5.10-full

USER root

WORKDIR /app

# RUN pip install --upgrade pip

COPY . .

RUN apt-get update && apt-get install -y python3-pip

RUN pip3 install -r requirements.txt

CMD rasa run --enable-api --cors * -m ./models/20230607-225139-noisy-noodle.tar.gz -vv --log-file out.log