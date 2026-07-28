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
        ? {
            billingDetails: {
              paymentTerms: { frequency: 1, interval: "month" },
            },
          }
        : {}),
      customData: customerEmail ? { email: customerEmail } : undefined,
    });

    const checkoutUrl = transaction.checkout?.url;

    if (!checkoutUrl) {
      console.error("Paddle: no checkout URL returned", JSON.stringify(transaction, null, 2));
      return NextResponse.json(
        { error: "Checkout session created but no URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as { statusCode?: number })?.statusCode;
    console.error(`Paddle checkout error [${status ?? "unknown"}]:`, msg);
    console.error("Full error:", JSON.stringify(error, null, 2));
    return NextResponse.json(
      { error: `Failed to create checkout: ${msg}` },
      { status: status ?? 500 }
    );
  }
}
