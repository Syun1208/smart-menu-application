from fastapi import FastAPI
from typing import List
import uvicorn
import requests


app_desc = """<h2>Made by`Pham Minh Long`</h2>"""
app = FastAPI(title="Chúa hề chatbot", description=app_desc)



@app.get("/")
async def hello_world():
    return {"message": "Hello"}

@app.post("/rasa/webhook")
async def rasa_webhook(message: str):
    url = "http://0.0.0.0:8080/webhooks/rest/webhook"

    payload = {
        "sender": "anh Long đẹp trai",
        "message": message
    }

    response = requests.post(url, json=payload)
    if response.status_code == 200: 
        response_data = response.json()
        if response_data and len(response_data) > 0:
            text_response = response_data[0].get("text", "")
            return {"text": text_response}
        else: 
            return {"text": "Tui không hiểu bạn đang nói qq gì :>"}
    else:
        return {"text": "Failed to send request to Rasa API. Status code:{}".format(response.status_code)}




if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=80)