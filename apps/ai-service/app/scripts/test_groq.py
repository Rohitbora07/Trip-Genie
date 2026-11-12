import asyncio

from app.integrations.groq_client import get_groq_model


async def main():
    model = get_groq_model()

    response = await model.ainvoke(
        "Tell me who is Aegon The Conqueror??"
    )

    print(response.content)


if __name__ == "__main__":
    asyncio.run(main())