/** Client-safe labels and styles. No Prisma import, so pages can use it. */
export type TicketStatusName =
  | "OPEN" | "WAITING_ON_US" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
export type TicketPriorityName = "LOW" | "NORMAL" | "HIGH" | "URGENT";

/** Wording the customer sees. */
export const STATUS_LABELS: Record<TicketStatusName, string> = {
  OPEN: "Open",
  WAITING_ON_US: "With us",
  WAITING_ON_CUSTOMER: "Needs your reply",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Wording staff see — the same states from the other side of the desk. */
export const STAFF_STATUS_LABELS: Record<TicketStatusName, string> = {
  OPEN: "Open",
  WAITING_ON_US: "Needs a reply",
  WAITING_ON_CUSTOMER: "Waiting on client",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const STATUS_STYLES: Record<TicketStatusName, string> = {
  OPEN: "bg-accent-soft text-accent",
  WAITING_ON_US: "bg-accent-soft text-accent",
  WAITING_ON_CUSTOMER: "bg-ink text-white",
  RESOLVED: "bg-subtle text-muted",
  CLOSED: "bg-subtle text-muted",
};

export const PRIORITY_LABELS: Record<TicketPriorityName, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ALL_STATUSES: TicketStatusName[] = [
  "OPEN", "WAITING_ON_US", "WAITING_ON_CUSTOMER", "RESOLVED", "CLOSED",
];
export const ALL_PRIORITIES: TicketPriorityName[] = ["LOW", "NORMAL", "HIGH", "URGENT"];
