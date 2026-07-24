import { NextResponse } from "next/server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment: Environment.sandbox,
});

export async function POST() {
  try {
    const transaction = await paddle.transactions.create({
      items: [
        {
          priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!,
          quantity: 1,
        },
      ],
    });

    return NextResponse.json({ url: transaction.checkout?.url });
  } catch (error) {
    console.error("Paddle checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
