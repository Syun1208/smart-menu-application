FROM rasa/rasa:3.5.10-full

USER root

WORKDIR /app

# RUN pip install --upgrade pip

COPY . .

RUN apt-get update && apt-get install -y python3-pip

RUN pip3 install -r requirements.txt

RUN bash install.sh