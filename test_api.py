import requests

url = "http://0.0.0.0:5005/webhooks/rest/webhook"

# Define the payload for the request
payload = {
    "sender": "user",
    "message": "sao m ngu dữ v"
}

# Send the POST request to the Rasa API
response = requests.post(url, json=payload)

# Process the response
if response.status_code == 200:
    # Get the response data in JSON format
    response_data = response.json()
    
    # Extract the text response from the API
    if response_data and len(response_data) > 0:
        text_response = response_data[0].get("text", "")
        print(response_data)
        print("Rasa API Response:", text_response)
    else:
        print("Empty response received from Rasa API")
else:
    print("Failed to send request to Rasa API. Status code:", response.status_code)
