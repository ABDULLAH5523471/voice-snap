import { NextResponse } from "next/server";
import { Webhooks } from "@paddle/paddle-node-sdk";

const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET!;

const EVENT_LOG: Record<string, string> = {
  "subscription.created":  "Subscription created",
  "subscription.activated": "Subscription activated",
  "subscription.updated":  "Subscription updated",
  "subscription.canceled": "Subscription canceled",
  "subscription.paused":   "Subscription paused",
  "subscription.resumed":  "Subscription resumed",
  "transaction.paid":      "Payment succeeded",
  "transaction.completed": "Payment completed",
  "transaction.payment_failed": "Payment failed",
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const paddleSignature = req.headers.get("paddle-signature") ?? "";

    const unmarshal = new Webhooks();
    const event = await unmarshal.unmarshal(rawBody, webhookSecret, paddleSignature);

    const eventName = event.eventType as string;
    const label = EVENT_LOG[eventName];

    if (label) {
      console.log(`[Paddle Webhook] ${label}:`, JSON.stringify(event.data, null, 2));
    } else {
      console.log(`[Paddle Webhook] Unhandled event: ${eventName}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Paddle Webhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
}
