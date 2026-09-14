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
  ecommerce: "Online store",
  webapp: "Web app",
  marketing: "Marketing",
  care: "Care & hosting",
};

export const FEATURE_LABELS: Record<Feature, string> = {
  cms: "Edit it yourself (CMS)",
  ecommerce: "Sell products online",
  booking: "Bookings / appointments",
  seo: "SEO setup",
  copywriting: "Copywriting included",
  hosting: "Hosting included",
};

export const BUDGET_LABELS: Record<BudgetBand, string> = {
  "under-500": "Under 500",
  "500-1500": "500 – 1,500",
  "1500-3000": "1,500 – 3,000",
  "3000-plus": "3,000+",
};

export const TIMELINE_LABELS: Record<TimelineBand, string> = {
  "under-1-week": "Under a week",
  "1-3-weeks": "1 – 3 weeks",
  "1-month-plus": "A month or more",
};

export const OFFERS: Offer[] = [
  {
    id: "landing-page",
    name: "Landing Page",
    summary:
      "One high-converting page to launch a product, run ads against, or replace a dead social bio link.",
    price: 399,
    category: "website",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "5–7 days",
    features: ["seo", "copywriting", "hosting"],
    includes: [
      "Single scrolling page, custom designed",
      "Mobile + tablet + desktop layouts",
      "Contact form wired to your inbox",
      "Basic SEO tags and analytics",
      "2 rounds of revisions",
    ],
  },
  {
    id: "business-website",
    name: "Business Website",
    summary:
      "The standard five-page site — home, services, about, contact, and one extra of your choosing.",
    price: 899,
    category: "website",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "2–3 weeks",
    features: ["cms", "seo", "copywriting", "hosting"],
    includes: [
      "Up to 5 custom-designed pages",
      "CMS so you can edit text and images",
      "Google Business + maps integration",
      "SEO setup and sitemap submission",
      "3 rounds of revisions",
    ],
    popular: true,
  },
  {
    id: "site-refresh",
    name: "Redesign & Refresh",
    summary:
      "Keep your content, replace the look. For sites that work but look ten years old.",
    price: 649,
    category: "website",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "1–2 weeks",
    features: ["cms", "seo"],
    includes: [
      "New design across your existing pages",
      "Speed and mobile fixes",
      "Content migrated for you",
      "Accessibility pass",
      "2 rounds of revisions",
    ],
  },
  {
    id: "online-store",
    name: "Online Store",
    summary:
      "A full e-commerce build with payments, stock tracking, and an order dashboard you actually understand.",
    price: 1899,
    category: "ecommerce",
    budget: "1500-3000",
    timeline: "1-month-plus",
    timelineLabel: "4–6 weeks",
    features: ["cms", "ecommerce", "seo", "hosting"],
    includes: [
      "Up to 50 products loaded for you",
      "Card payments via Stripe",
      "Stock, shipping, and tax rules",
      "Abandoned-cart emails",
      "Staff training call",
    ],
  },
  {
    id: "booking-system",
    name: "Booking System",
    summary:
      "For salons, trades, clinics, and anyone still taking appointments over DMs.",
    price: 1200,
    category: "webapp",
    budget: "500-1500",
    timeline: "1-3-weeks",
    timelineLabel: "3 weeks",
    features: ["booking", "cms", "hosting"],
    includes: [
      "Calendar with staff availability",
      "Automatic email + SMS reminders",
      "Deposits taken at booking",
      "Syncs with Google Calendar",
      "Admin view for your team",
    ],
  },
  {
    id: "custom-web-app",
    name: "Custom Web App",
    summary:
      "Dashboards, portals, internal tools — when an off-the-shelf template genuinely won't do it.",
    price: 3500,
    priceUnit: "+",
    category: "webapp",
    budget: "3000-plus",
    timeline: "1-month-plus",
    timelineLabel: "6+ weeks",
    features: ["cms", "booking", "hosting"],
    includes: [
      "Discovery workshop and written spec",
      "User accounts and permissions",
      "Custom database and admin panel",
      "API integrations with your tools",
      "30 days of post-launch support",
    ],
  },
  {
    id: "seo-starter",
    name: "SEO Starter",
    summary:
      "A one-off audit and fix-up so people can actually find the site you already paid for.",
    price: 299,
    category: "marketing",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "4–5 days",
    features: ["seo", "copywriting"],
    includes: [
      "Full technical SEO audit",
      "Keyword research for your area",
      "Titles and descriptions rewritten",
      "Google Search Console setup",
      "Plain-English report",
    ],
  },
  {
    id: "care-plan",
    name: "Care Plan",
    summary:
      "Hosting, backups, updates, and a human who answers when something breaks.",
    price: 79,
    priceUnit: "/mo",
    category: "care",
    budget: "under-500",
    timeline: "under-1-week",
    timelineLabel: "Starts immediately",
    features: ["hosting", "seo"],
    includes: [
      "Fast managed hosting + SSL",
      "Daily backups, 30-day history",
      "Software and security updates",
      "1 hour of content edits monthly",
      "Uptime monitoring and alerts",
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
      `Looking for: ${filters.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}`,
    );
  }
  if (filters.budgets.length) {
    parts.push(
      `Budget: ${filters.budgets.map((b) => BUDGET_LABELS[b]).join(", ")}`,
    );
  }
  if (filters.timelines.length) {
    parts.push(
      `Timeline: ${filters.timelines.map((t) => TIMELINE_LABELS[t]).join(", ")}`,
    );
  }
  if (filters.features.length) {
    parts.push(
      `Also want: ${filters.features.map((f) => FEATURE_LABELS[f]).join(", ")}`,
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
