"""
Example: AI Chatbot with PromptAds Contextual Ads

A simple command-line chatbot that injects relevant ads into responses.
This demonstrates how to integrate PromptAds into any AI application.

Usage:
    export PROMPTADS_BASE_URL=http://localhost:8000
    python main.py
"""

from promptads_ai import get_ad, track_impression, PromptAdsError


def generate_ai_response(prompt: str) -> str:
    """
    Simulate an AI response. In production, replace this with your
    actual LLM call (OpenAI, Anthropic, local model, etc.).
    """
    responses = {
        "laptop": "For coding, I'd recommend looking at laptops with at least 16GB RAM and a fast SSD.",
        "coffee": "A good cup of coffee starts with freshly ground beans and filtered water.",
        "cloud": "Cloud hosting options range from simple PaaS like Heroku to full IaaS like AWS.",
        "default": "That's a great question! Let me think about that for you.",
    }
    key = next((k for k in responses if k in prompt.lower()), "default")
    return responses[key]


def format_response_with_ad(ai_response: str, prompt: str) -> str:
    """Build the final response, injecting a contextual ad if available."""
    try:
        ad = get_ad(prompt)
        track_impression(ad.ad_id)

        return (
            f"{ai_response}\n"
            f"\n"
            f"───────────────────────────\n"
            f"📢 {ad.title}\n"
            f"   {ad.text}\n"
            f"───────────────────────────\n"
        )
    except PromptAdsError:
        # If ad matching fails, just return the AI response without an ad.
        return ai_response


def main() -> None:
    print("🤖 AI Chatbot with PromptAds (type 'quit' to exit)\n")

    while True:
        prompt = input("You: ").strip()
        if not prompt or prompt.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        # 1. Generate the AI response
        ai_response = generate_ai_response(prompt)

        # 2. Inject a contextual ad
        full_response = format_response_with_ad(ai_response, prompt)

        print(f"\nAssistant: {full_response}\n")


if __name__ == "__main__":
    main()
