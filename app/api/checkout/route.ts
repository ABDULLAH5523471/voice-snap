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

    const transaction = await paddle.transactions.create({
      items: [
        {
          priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID!,
          quantity: 1,
        },
      ],
      ...(customerEmail
        ? { customer: { email: customerEmail } }
        : {}),
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

    // Surface actionable dashboard config errors
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
