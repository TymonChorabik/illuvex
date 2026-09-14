import { NextResponse } from "next/server";
import { createOrder, listOrdersByEmail, markEmailSent } from "@/lib/db";
import { sendOrderEmails } from "@/lib/email";
import { getOffer } from "@/lib/offers";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  // Submitting a request sends two emails, so this is the expensive endpoint.
  const limit = rateLimit(clientKey(request, "orders-post"), 5, 10 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "Too many requests sent. Please wait a few minutes and try again.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const offerId = clean(payload.offerId, 100);
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 200);
  const company = clean(payload.company, 120);
  const phone = clean(payload.phone, 40);
  const notes = clean(payload.notes, 2000);

  // No offerId means a custom quote request — no site package to browse, so
  // this is how a visitor asks for one instead of picking from a catalogue.
  const isCustom = offerId.length === 0;
  const offer = isCustom ? null : getOffer(offerId);
  if (!isCustom && !offer) {
    return NextResponse.json(
      { error: "That package no longer exists." },
      { status: 400 },
    );
  }
  if (name.length < 2) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (isCustom && notes.length < 5) {
    return NextResponse.json(
      { error: "Tell us a bit about what you need." },
      { status: 400 },
    );
  }

  // Price comes from the server-side catalog, never from the request body.
  // A custom request has no catalogue entry, so it is priced 0 (shown as
  // "Custom quote" everywhere a price is displayed) until staff raise a real
  // offerte for it.
  const order = await createOrder({
    packageSlug: offer ? offer.id : "custom",
    offerName: offer ? offer.name : "Custom quote request",
    price: offer ? offer.price : 0,
    priceUnit: offer?.priceUnit,
    name,
    email,
    company: company || undefined,
    phone: phone || undefined,
    notes: notes || undefined,
  });

  const result = await sendOrderEmails(order);
  if (result.sent) await markEmailSent(order.id);

  return NextResponse.json(
    {
      order: { ...order, emailSent: result.sent },
      emailSent: result.sent,
      emailError: result.reason,
    },
    { status: 201 },
  );
}

export async function GET(request: Request) {
  // Order lookup is by email alone, so throttle it against enumeration.
  const limit = rateLimit(clientKey(request, "orders-get"), 20, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfter, "Too many lookups. Slow down.");
  }

  const email = new URL(request.url).searchParams.get("email")?.trim() ?? "";
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: "Enter the email address you ordered with." },
      { status: 400 },
    );
  }

  const orders = await listOrdersByEmail(email);
  return NextResponse.json({ orders });
}
