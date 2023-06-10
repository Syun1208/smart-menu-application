FROM rasa/rasa:3.5.10-full

EXPOSE 8080

USER root

WORKDIR /app

# RUN pip install --upgrade pip

COPY . .

RUN apt-get update && apt-get install -y python3-pip

RUN pip3 install -r requirements.txt

# COPY ./chatbot ./chatbot

#CMD ["rasa", "run", "--enable-api", "--cors", "*", "-m", "./models/20230607-225139-noisy-noodle.tar.gz", "-vv", "--log-file", "out.log", "-p", "5005", "--debug"]
CMD gunicorn -w 4 -k uvicorn.workers.UvicornWorker fast_api:app