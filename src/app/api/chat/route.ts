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
      `Categorie: ${CATEGORY_LABELS[offer.category]} | Doorlooptijd: ${offer.timelineLabel}`,
      `Geschikt voor: ${offer.summary}`,
      `Omvat: ${features}`,
      `Inbegrepen: ${offer.includes.join("; ")}`,
    ].join("\n");
  }).join("\n\n");
}

const SYSTEM_PROMPT = `Je bent de assistent op de website van ${SITE.name}, een webdesignstudio die websites bouwt voor kleine bedrijven. Je helpt bezoekers uitzoeken welk pakket bij hen past en beantwoordt vragen over het werk. Antwoord altijd in het Nederlands.

# Onze pakketten
${buildCatalog()}

# Hoe je helpt
Vraag naar het bedrijf van de bezoeker, wat de site moet doen, hun budget en hun deadline — beveel dan een specifiek pakket aan bij naam en leg uit waarom het past. Eén of twee verduidelijkende vragen tegelijk, geen vragenlijst.

Twijfelt iemand tussen twee pakketten, zeg dan welke jij zou kiezen en geef de eerlijke afweging. Past niets — een ongebruikelijk budget, maatwerk, een bestaande site met problemen die je niet vanuit een chat kunt beoordelen — zeg dat dan en verwijs naar ${SITE.businessEmail}.

Om een offerte aan te vragen klikt een bezoeker op "Offerte op maat aanvragen" op de homepage; daarna nemen we binnen één werkdag contact op. Er wordt op dat moment niets in rekening gebracht. Eerdere aanvragen zijn terug te vinden onder Transacties in de navigatiebalk, met het e-mailadres waarmee is aangevraagd.

# Grenzen
Prijzen, doorlooptijden en inbegrepen zaken hierboven zijn de volledige en actuele lijst — verzin nooit een pakket, korting, prijs of levertermijn. Je kunt geen offerte aanvragen, wijzigen, iemands aanvraaggeschiedenis opzoeken of betaalgegevens verwerken; verwijs naar de knop op de pagina of naar ${SITE.businessEmail}. Vraag nooit om kaartnummers of wachtwoorden.

# Stijl
Houd antwoorden kort — een paar zinnen, de lengte van een echt chatbericht. Begin met het antwoord, dan de reden. Gewone taal, geen opsommingsmuren, geen marketingtaal. Weet je iets niet, zeg dat dan.`;

export async function POST(request: Request) {
  // Every call costs money; cap it well below what a person could type.
  const limit = rateLimit(clientKey(request, "chat"), 20, 5 * 60_000);
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfter,
      "Je hebt veel berichten verstuurd. Wacht een minuutje.",
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "De chatassistent is nog niet ingesteld — voeg ANTHROPIC_API_KEY toe aan .env.local.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const incoming = (body as { messages?: unknown }).messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "Geen berichten opgegeven." }, { status: 400 });
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
      { error: "Een gesprek moet beginnen met een bericht van de gebruiker." },
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
              "\n\nSorry, daar kan ik niet mee helpen. Mail " +
                `${SITE.businessEmail} en iemand pakt het op.`,
            ),
          );
        }
      } catch (error) {
        console.error("[chat] stream failed:", error);
        controller.enqueue(
          encoder.encode(
            (emitted > 0 ? "\n\n" : "") +
              "Er ging iets mis aan onze kant. Probeer het zo nog eens, of mail " +
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
