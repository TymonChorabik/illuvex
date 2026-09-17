import { NextResponse } from "next/server";
import { listAllOrders, updateOrderStatus } from "@/lib/db";
import { isOrderStatus } from "@/lib/order-status";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const orders = await listAllOrders();
  return NextResponse.json({ orders });
}

export async function PATCH(request: Request) {
  const auth = await requireStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const { id, status } = body as { id?: unknown; status?: unknown };
  if (typeof id !== "string" || !id || id.length > 100) {
    return NextResponse.json({ error: "Aanvraag-id ontbreekt." }, { status: 400 });
  }
  if (!isOrderStatus(status)) {
    return NextResponse.json({ error: "Onbekende status." }, { status: 400 });
  }

  const order = await updateOrderStatus(id, status);
  if (!order) {
    return NextResponse.json({ error: "Aanvraag niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ order });
}
