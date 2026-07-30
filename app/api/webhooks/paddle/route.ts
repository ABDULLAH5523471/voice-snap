import { NextResponse } from "next/server";
import { Webhooks } from "@paddle/paddle-node-sdk";
import { clerkClient } from "@clerk/nextjs/server";

const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  try {
    if (!webhookSecret) {
      console.error("[Paddle Webhook] Missing PADDLE_WEBHOOK_SECRET environment variable");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const rawBody = await req.text();
    const paddleSignature = req.headers.get("paddle-signature") ?? "";

    const unmarshal = new Webhooks();
    const event = await unmarshal.unmarshal(rawBody, webhookSecret, paddleSignature);

    const eventName = event.eventType as string;
    const data = event.data ? (event.data as unknown as Record<string, unknown>) : null;
    if (!data) {
      console.warn(`[Paddle Webhook] Event ${eventName} has no data`);
      return NextResponse.json({ received: true });
    }

    const dataAny = data as Record<string, unknown>;
    const customer = dataAny.customer as Record<string, unknown> | undefined;
    const customerEmail = (customer?.email as string) ?? (dataAny.customer_email as string);

    console.log(`[Paddle Webhook] Received: ${eventName}`, {
      customerEmail,
      subscriptionId: dataAny.id,
    });

    if (eventName.startsWith("subscription.") || eventName === "transaction.completed" || eventName === "transaction.paid") {
      if (!customerEmail) {
        console.warn(`[Paddle Webhook] ${eventName} has no customer email, skipping metadata update`);
        return NextResponse.json({ received: true });
      }

      const client = await clerkClient();

      const userList = await client.users.getUserList({ emailAddress: [customerEmail] });
      const clerkUser = userList.data?.[0];

      if (!clerkUser) {
        console.warn(`[Paddle Webhook] No Clerk user found for email: ${customerEmail}`);
        return NextResponse.json({ received: true });
      }

      if (eventName === "subscription.canceled") {
        await client.users.updateUser(clerkUser.id, {
          publicMetadata: {
            subscription_status: "canceled",
            subscription_id: null,
          },
        });
        console.log(`[Paddle Webhook] Cleared Pro status for Clerk user ${clerkUser.id}`);
      } else if (
        eventName === "subscription.created" ||
        eventName === "subscription.activated" ||
        eventName === "subscription.updated"
      ) {
        await client.users.updateUser(clerkUser.id, {
          publicMetadata: {
            subscription_status: "active",
            subscription_id: dataAny.id,
          },
        });
        console.log(`[Paddle Webhook] Set Pro status for Clerk user ${clerkUser.id}, sub=${dataAny.id}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Paddle Webhook] Error:", error);
    return NextResponse.json({ error: "Invalid signature or processing error" }, { status: 400 });
  }
}
