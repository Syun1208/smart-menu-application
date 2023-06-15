export PROJECT_ID=chatbot-rasa
export BILLING_ACCOUNT_ID=015200-ED6110-D71885
export APP=chatbot 
export PORT=8080
export IMAGE=chatbot_rasa:latest
export REGION="europe-west3" 
export TAG="syun1208/gcr.io/$PROJECT_ID/$IMAGE"

gcloud projects create $PROJECT_ID --name="Chatbot RASA"

gcloud config set project $PROJECT_ID

gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT_ID
