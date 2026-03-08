# Example: AI Chatbot with PromptAds

A simple command-line chatbot that demonstrates how to integrate PromptAds
contextual ads into any AI application.

## How It Works

1. User sends a message to the chatbot
2. Chatbot generates an AI response (simulated — replace with your LLM)
3. The user prompt is sent to PromptAds to find a relevant contextual ad
4. The ad is appended below the response

## Prerequisites

Make sure the PromptAds backend is running:

    docker compose up -d

## Run the Python Example

    cd examples/chatbot/python
    pip install promptads-ai          # or: pip install -e ../../sdk/python
    export PROMPTADS_BASE_URL=http://localhost:8000
    python main.py

## Run the JavaScript Example

    cd examples/chatbot/javascript
    npm install promptads-ai          # or: npm link ../../sdk/js
    export PROMPTADS_BASE_URL=http://localhost:8000
    npx tsx index.ts

## Adapting for Production

Replace the simulated AI response function with your actual LLM call
(OpenAI, Anthropic, a local model, etc.). The PromptAds integration
stays the same — send the user prompt, get an ad, append it to the response.
