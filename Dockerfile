# Use the official Python image as the base image
FROM python:3.7

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file to the container
COPY requirements.txt .

# Install Rasa and dependencies
RUN pip install --upgrade pip \
    pip install --no-cache-dir rasa==3.5.10

# Copy the rest of the Rasa project to the container
COPY . .

# Set the command to run the Rasa API server
CMD ["rasa", "run", "-p", "8080", "--cors", "*", "--enable-api", "-m", "./models/20230609-151105-selfish-heap.tar.gz"]