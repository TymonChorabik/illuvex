/**
 * Client-safe: no filesystem imports, so browser components can pull these in
 * without dragging the order store into the bundle.
 */
export type OrderStatus = "pending" | "confirmed" | "in-progress" | "complete";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "in-progress",
  "complete",
];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting reply",
  confirmed: "Confirmed",
  "in-progress": "In progress",
  complete: "Complete",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-accent-soft text-accent",
  confirmed: "bg-subtle text-ink",
  "in-progress": "bg-subtle text-ink",
  complete: "bg-subtle text-muted",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus)
  );
}
