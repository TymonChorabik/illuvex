import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getTenantId } from "@/lib/tenant";
import { SITE } from "@/lib/site";
import type { OrderStatus } from "@/lib/order-status";
import type { OrderStatus as DbOrderStatus } from "@/generated/prisma/client";

export type { OrderStatus };

/**
 * The shape the UI and API speak. Deliberately kept stable across the move
 * from a JSON file to Postgres so the pages did not have to change: prices
 * stay whole units here, while the database stores integer cents.
 */
export type Order = {
  id: string;
  reference: string;
  offerId: string | null;
  offerName: string;
  price: number;
  priceUnit?: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
  status: OrderStatus;
  emailSent: boolean;
  createdAt: string;
};

const TO_DB: Record<OrderStatus, DbOrderStatus> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  "in-progress": "IN_PROGRESS",
  complete: "COMPLETE",
};

const FROM_DB: Record<DbOrderStatus, OrderStatus> = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in-progress",
  COMPLETE: "complete",
  // The UI has no cancelled state yet; show it as complete rather than crash.
  CANCELLED: "complete",
};

type Row = {
  id: string;
  reference: string;
  packageId: string | null;
  packageName: string;
  priceCents: number;
  priceUnit: string | null;
  contactName: string;
  contactEmail: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  status: DbOrderStatus;
  confirmationEmailSentAt: Date | null;
  createdAt: Date;
};

function toOrder(row: Row): Order {
  return {
    id: row.id,
    reference: row.reference,
    offerId: row.packageId,
    offerName: row.packageName,
    price: row.priceCents / 100,
    priceUnit: row.priceUnit ?? undefined,
    name: row.contactName,
    email: row.contactEmail,
    company: row.company ?? undefined,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    status: FROM_DB[row.status],
    emailSent: row.confirmationEmailSentAt !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  reference: true,
  packageId: true,
  packageName: true,
  priceCents: true,
  priceUnit: true,
  contactName: true,
  contactEmail: true,
  company: true,
  phone: true,
  notes: true,
  status: true,
  confirmationEmailSentAt: true,
  createdAt: true,
} as const;

function makeReference() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${SITE.referencePrefix}-${stamp}-${suffix}`;
}

export type NewOrder = {
  packageSlug: string;
  offerName: string;
  price: number;
  priceUnit?: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  notes?: string;
};

export async function createOrder(input: NewOrder): Promise<Order> {
  const tenantId = await getTenantId();

  // Link to the catalogue row when one matches, but never fail the order if
  // the package was renamed or retired — the snapshot below is the record.
  const pkg = await prisma.package.findUnique({
    where: { tenantId_slug: { tenantId, slug: input.packageSlug } },
    select: { id: true },
  });

  // References are random, so a collision is possible if vanishingly unlikely.
  // Retry rather than hand the customer an error.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const row = await prisma.order.create({
        data: {
          tenantId,
          packageId: pkg?.id ?? null,
          reference: makeReference(),
          packageName: input.offerName,
          priceCents: Math.round(input.price * 100),
          priceUnit: input.priceUnit ?? null,
          contactName: input.name,
          contactEmail: input.email.toLowerCase(),
          company: input.company ?? null,
          phone: input.phone ?? null,
          notes: input.notes ?? null,
        },
        select: SELECT,
      });
      return toOrder(row);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error; // not a unique-constraint clash
    }
  }
  throw new Error("Could not allocate a unique order reference.");
}

export async function markEmailSent(id: string) {
  const tenantId = await getTenantId();
  await prisma.order.updateMany({
    where: { id, tenantId },
    data: { confirmationEmailSentAt: new Date() },
  });
}

export async function listOrdersByEmail(email: string): Promise<Order[]> {
  const tenantId = await getTenantId();
  const rows = await prisma.order.findMany({
    where: { tenantId, contactEmail: email.trim().toLowerCase() },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  return rows.map(toOrder);
}

export async function listAllOrders(): Promise<Order[]> {
  const tenantId = await getTenantId();
  const rows = await prisma.order.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: SELECT,
  });
  return rows.map(toOrder);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order | null> {
  const tenantId = await getTenantId();
  // updateMany so the tenant filter is enforced; update() would ignore it.
  const { count } = await prisma.order.updateMany({
    where: { id, tenantId },
    data: { status: TO_DB[status] },
  });
  if (count === 0) return null;

  const row = await prisma.order.findFirst({
    where: { id, tenantId },
    select: SELECT,
  });
  return row ? toOrder(row) : null;
}
