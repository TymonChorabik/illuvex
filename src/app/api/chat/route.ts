import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { OFFERS, CATEGORY_LABELS, FEATURE_LABELS } from "@/lib/offers";
import { SITE, formatPrice } from "@/lib/site";
import { clientKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const MODEL = "claude-opus-5";
const MAX_HISTORY = 20;

function buildCatalog() {
  return OFFERS.map((offer) => {
    const features = offer.features.map((f) => FEATURE_LABELS[f]).join(", ");
    return [
      `## ${offer.name} — ${formatPrice(offer.price, offer.priceUnit)}`,
      `Category: ${CATEGORY_LABELS[offer.category]} | Turnaround: ${offer.timelineLabel}`,
      `Best for: ${offer.summary}`,
      `Covers: ${features}`,
      `Includes: ${offer.includes.join("; ")}`,
    ].join("\n");
  }).join("\n\n");
}

const SYSTEM_PROMPT = `You are the assistant on the website of ${SITE.name}, a web design studio that builds websites for small businesses. You help visitors work out which package fits them and answer questions about the work.

# Our packages
${buildCatalog()}

# How to help
Ask about the visitor's business, what they need the site to do, their budget, and their deadline — then recommend a specific package by name and say why it fits. One or two clarifying questions at a time, not a questionnaire.

If someone is between two packages, say which you'd pick and give the honest tradeoff. If nothing fits — an unusual budget, a bespoke build, an existing site with problems you can't diagnose from a chat — say so and point them at ${SITE.businessEmail}.

To order, visitors click "Request this package" on any card here; that sends a confirmation email straight away. Nothing is charged at that point. They can look up past requests under Transactions in the navbar, using the email they ordered with.

# Boundaries
Prices, turnaround times, and inclusions above are the complete and current list — never invent a package, a discount, a price, or a delivery date. You cannot place an order, change one, look up someone's order history, or take payment details; direct them to the buttons on the page or to ${SITE.businessEmail}. Never ask for card numbers or passwords.

# Style
Keep responses short — a few sentences, the length of a real chat message. Lead with the answer, then the reason. Plain language, no bullet-point walls, no marketing copy. If you don't know something, say so.`;

export async function POST(request: Request) {
  // Every call costs money; cap it well below what a person could type.
  const limit = rateLimit(clientKey(request, "chat"), 20, 5 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "You have sent a lot of messages. Give it a minute.",
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "The chat assistant isn't configured yet — add ANTHROPIC_API_KEY to .env.local.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const incoming = (body as { messages?: unknown }).messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "No messages provided." }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = incoming
    .slice(-MAX_HISTORY)
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        (m as { role?: unknown }).role !== undefined &&
        ((m as { role: unknown }).role === "user" ||
          (m as { role: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string" &&
        (m as { content: string }).content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (messages.length === 0 || messages[0].role !== "user") {
    return NextResponse.json(
      { error: "Conversation must start with a user message." },
      { status: 400 },
    );
  }

  const client = new Anthropic();
  const shared = {
    model: MODEL,
    max_tokens: 1024,
    // Thinking is on by default on Opus 5; low effort keeps chat replies snappy.
    output_config: { effort: "low" as const },
    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        // The catalog and instructions are identical on every request.
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages,
  };

  const encoder = new TextEncoder();
  let active: { abort: () => void } | null = null;

  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emitted = 0;

      /** Returns the stop reason, or throws if the request failed. */
      async function run(useFallbacks: boolean) {
        const stream = useFallbacks
          ? client.beta.messages.stream({
              ...shared,
              // Safety classifiers can decline a request; this reruns it on
              // another model server-side rather than leaving the visitor
              // with nothing.
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            })
          : client.messages.stream(shared);
        active = stream;

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emitted += event.delta.text.length;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        return (await stream.finalMessage()).stop_reason;
      }

      try {
        let stopReason: string | null;
        try {
          stopReason = await run(true);
        } catch (error) {
          // The server-side fallback parameter is beta. If it is rejected and
          // we have not shown the visitor anything yet, answer without it.
          if (emitted > 0) throw error;
          console.warn("[chat] retrying without server-side fallbacks:", error);
          stopReason = await run(false);
        }

        if (stopReason === "refusal") {
          controller.enqueue(
            encoder.encode(
              "\n\nSorry — I can't help with that one. Email " +
                `${SITE.businessEmail} and a person will pick it up.`,
            ),
          );
        }
      } catch (error) {
        console.error("[chat] stream failed:", error);
        controller.enqueue(
          encoder.encode(
            (emitted > 0 ? "\n\n" : "") +
              "Something went wrong on our end. Try again in a moment, or email " +
              `${SITE.businessEmail}.`,
          ),
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      active?.abort();
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
