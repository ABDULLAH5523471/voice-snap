import { NextResponse } from "next/server";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const paddle = new Paddle(process.env.PADDLE_API_KEY!, {
  environment: process.env.PADDLE_API_KEY?.includes("_sdbx_")
    ? Environment.sandbox
    : Environment.production,
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customerEmail: string | undefined = body?.email;

    let customerId: string | undefined;

    if (customerEmail) {
      const existing = await paddle.customers.list({ email: [customerEmail] });
      const customers = await existing.next();
      const first = customers?.[0];
      if (first) {
        customerId = first.id;
      } else {
        const created = await paddle.customers.create({ email: customerEmail });
        customerId = created.id;
      }
    }

    const transaction = await paddle.transactions.create({
      items: [
        {
          priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!,
          quantity: 1,
        },
      ],
      ...(customerId ? { customerId } : {}),
    });

    const checkoutUrl = transaction.checkout?.url;

    if (!checkoutUrl) {
      console.error("[Paddle] No checkout URL returned:", JSON.stringify(transaction, null, 2));
      return NextResponse.json(
        { error: "Checkout session created but no URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      statusCode?: number;
      type?: string;
      code?: string;
    };

    console.error(`[Paddle] Checkout error [${err.statusCode ?? "??"}]:`, err.message);

    if (err.code === "transaction_default_checkout_url_not_set") {
      return NextResponse.json(
        {
          error:
            "Paddle checkout not configured. Go to Paddle Dashboard → Checkout settings → set a Default Payment Link.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: err.message ?? "Failed to create checkout session" },
      { status: err.statusCode ?? 500 }
    );
  }
}
