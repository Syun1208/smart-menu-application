import requests

url = "http://0.0.0.0:5005/webhooks/rest/webhook"
payload = {
    "message": "Hello"
}

response = requests.post(url, json=payload)
print(response.json())