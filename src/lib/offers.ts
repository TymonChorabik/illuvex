export type Category =
  | "website"
  | "ecommerce"
  | "webapp"
  | "marketing"
  | "care";

export type Feature =
  | "cms"
  | "ecommerce"
  | "booking"
  | "seo"
  | "copywriting"
  | "hosting";

export type BudgetBand = "under-500" | "500-1500" | "1500-3000" | "3000-plus";
export type TimelineBand = "under-1-week" | "1-3-weeks" | "1-month-plus";

export type Offer = {
  id: string;
  name: string;
  summary: string;
  price: number;
  /** Suffix after the price, e.g. "/mo" or " onwards". */
  priceUnit?: string;
  category: Category;
  budget: BudgetBand;
  timeline: TimelineBand;
  timelineLabel: string;
  features: Feature[];
  includes: string[];
  popular?: boolean;
};

export const CATEGORY_LABELS: Record<Category, string> = {
  website: "Website",
  ecommerce: "Webshop",
  webapp: "Webapplicatie",
  marketing: "Marketing",
  care: "Onderhoud & hosting",
};

export const FEATURE_LABELS: Record<Feature, string> = {
  cms: "Zelf te bewerken (CMS)",
  ecommerce: "Producten online verkopen",
  booking: "Boekingen / afspraken",
  seo: "SEO-instellingen",
  copywriting: "Inclusief copywriting",
  hosting: "Inclusief hosting",
};

export const BUDGET_LABELS: Record<BudgetBand, string> = {
  "under-500": "Tot 500",
  "500-1500": "500 – 1.500",
  "1500-3000": "1.500 – 3.000",
  "3000-plus": "3.000+",
};

export const TIMELINE_LABELS: Record<TimelineBand, string> = {
  "under-1-week": "Binnen een week",
  "1-3-weeks": "1 – 3 weken",
  "1-month-plus": "Een maand of langer",
};

export const OFFERS: Offer[] = [
  {
    id: "landing-page",
    name: "Landingspagina",
    summary:
      "Eén converterende pagina om een product te lanceren, advertenties op te draaien of een dode social-bio-link te vervangen.",
    price: 399,
    category: "website",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "5–7 dagen",
    features: ["seo", "copywriting", "hosting"],
    includes: [
      "Eén scrollende pagina, op maat ontworpen",
      "Layouts voor mobiel + tablet + desktop",
      "Contactformulier gekoppeld aan je inbox",
      "Basis SEO-tags en analytics",
      "2 revisierondes",
    ],
  },
  {
    id: "business-website",
    name: "Bedrijfswebsite",
    summary:
      "De standaard vijf-pagina's-site — home, diensten, over ons, contact, en één pagina naar keuze.",
    price: 899,
    category: "website",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "2–3 weken",
    features: ["cms", "seo", "copywriting", "hosting"],
    includes: [
      "Tot 5 pagina's, op maat ontworpen",
      "CMS zodat je zelf tekst en afbeeldingen aanpast",
      "Google Bedrijfsprofiel + maps-integratie",
      "SEO-instellingen en sitemap-aanmelding",
      "3 revisierondes",
    ],
    popular: true,
  },
  {
    id: "site-refresh",
    name: "Redesign & Refresh",
    summary:
      "Behoud je content, vervang de uitstraling. Voor sites die werken maar er tien jaar oud uitzien.",
    price: 649,
    category: "website",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "1–2 weken",
    features: ["cms", "seo"],
    includes: [
      "Nieuw design over je bestaande pagina's",
      "Snelheids- en mobielverbeteringen",
      "Content voor je overgezet",
      "Toegankelijkheidscontrole",
      "2 revisierondes",
    ],
  },
  {
    id: "online-store",
    name: "Webshop",
    summary:
      "Een volledige e-commerce-oplossing met betalingen, voorraadbeheer en een orderoverzicht dat je echt begrijpt.",
    price: 1899,
    category: "ecommerce",
    budget: "1500-3000",
    timeline: "1-month-plus",
    timelineLabel: "4–6 weken",
    features: ["cms", "ecommerce", "seo", "hosting"],
    includes: [
      "Tot 50 producten voor je ingeladen",
      "Kaartbetalingen via Stripe",
      "Voorraad-, verzend- en btw-regels",
      "E-mails voor achtergelaten winkelwagens",
      "Trainingsgesprek voor je team",
    ],
  },
  {
    id: "booking-system",
    name: "Boekingssysteem",
    summary:
      "Voor salons, vakmensen, klinieken en iedereen die nog afspraken via DM's plant.",
    price: 1200,
    category: "webapp",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "3 weken",
    features: ["booking", "cms", "hosting"],
    includes: [
      "Agenda met beschikbaarheid per medewerker",
      "Automatische e-mail- + sms-herinneringen",
      "Aanbetaling bij boeking",
      "Synchroniseert met Google Agenda",
      "Beheerdersoverzicht voor je team",
    ],
  },
  {
    id: "custom-web-app",
    name: "Maatwerk Webapplicatie",
    summary:
      "Dashboards, portals, interne tools — wanneer een kant-en-klare template écht niet volstaat.",
    price: 3500,
    priceUnit: "+",
    category: "webapp",
    budget: "3000-plus",
    timeline: "1-month-plus",
    timelineLabel: "6+ weken",
    features: ["cms", "booking", "hosting"],
    includes: [
      "Discovery-sessie en geschreven specificatie",
      "Gebruikersaccounts en rechten",
      "Eigen database en beheerpaneel",
      "API-koppelingen met je tools",
      "30 dagen ondersteuning na livegang",
    ],
  },
  {
    id: "seo-starter",
    name: "SEO Starter",
    summary:
      "Een eenmalige audit en opknapbeurt zodat mensen de site die je al betaald hebt ook echt vinden.",
    price: 299,
    category: "marketing",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "4–5 dagen",
    features: ["seo", "copywriting"],
    includes: [
      "Volledige technische SEO-audit",
      "Zoekwoordenonderzoek voor jouw regio",
      "Titels en beschrijvingen herschreven",
      "Google Search Console ingesteld",
      "Rapport in begrijpelijke taal",
    ],
  },
  {
    id: "care-plan",
    name: "Onderhoudsplan",
    summary:
      "Hosting, back-ups, updates, en een mens die antwoordt als er iets kapot gaat.",
    price: 79,
    priceUnit: "/mnd",
    category: "care",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "Start direct",
    features: ["hosting", "seo"],
    includes: [
      "Snelle managed hosting + SSL",
      "Dagelijkse back-ups, 30 dagen historie",
      "Software- en beveiligingsupdates",
      "1 uur content-aanpassingen per maand",
      "Uptime-monitoring en meldingen",
    ],
  },
];

export function getOffer(id: string) {
  return OFFERS.find((offer) => offer.id === id);
}

export type FilterState = {
  categories: Category[];
  budgets: BudgetBand[];
  timelines: TimelineBand[];
  features: Feature[];
};

export const EMPTY_FILTERS: FilterState = {
  categories: [],
  budgets: [],
  timelines: [],
  features: [],
};

/** An empty group means "no preference", so it matches everything. */
export function filterOffers(offers: Offer[], filters: FilterState) {
  return offers.filter((offer) => {
    if (
      filters.categories.length &&
      !filters.categories.includes(offer.category)
    ) {
      return false;
    }
    if (filters.budgets.length && !filters.budgets.includes(offer.budget)) {
      return false;
    }
    if (filters.timelines.length && !filters.timelines.includes(offer.timeline)) {
      return false;
    }
    // Features are AND-ed: tick two and you only see offers with both.
    if (
      filters.features.length &&
      !filters.features.every((feature) => offer.features.includes(feature))
    ) {
      return false;
    }
    return true;
  });
}

/** Turns picked filters into a readable summary to pre-fill a quote request. */
export function describeFilters(filters: FilterState): string {
  const parts: string[] = [];
  if (filters.categories.length) {
    parts.push(
      `Op zoek naar: ${filters.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}`,
    );
  }
  if (filters.budgets.length) {
    parts.push(
      `Budget: ${filters.budgets.map((b) => BUDGET_LABELS[b]).join(", ")}`,
    );
  }
  if (filters.timelines.length) {
    parts.push(
      `Doorlooptijd: ${filters.timelines.map((t) => TIMELINE_LABELS[t]).join(", ")}`,
    );
  }
  if (filters.features.length) {
    parts.push(
      `Ook gewenst: ${filters.features.map((f) => FEATURE_LABELS[f]).join(", ")}`,
    );
  }
  return parts.join("\n");
}

export function countActiveFilters(filters: FilterState) {
  return (
    filters.categories.length +
    filters.budgets.length +
    filters.timelines.length +
    filters.features.length
  );
}
