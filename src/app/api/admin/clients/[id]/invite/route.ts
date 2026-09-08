import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getTenantId } from "@/lib/tenant";
import { inviteClientUser } from "@/lib/invite";
import { sendInviteEmail } from "@/lib/invite-email";

/** Invites a client to the portal and emails them a set-password link. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/clients/[id]/invite">,
) {
  const auth = await requireStaff();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const result = await inviteClientUser(await getTenantId(), id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const origin = process.env.PUBLIC_URL ?? new URL(request.url).origin;
  const link = `${origin}/portal/set-password?token=${result.token}`;
  const email = await sendInviteEmail(result.email, link);

  return NextResponse.json({
    ok: true,
    isNew: result.isNew,
    emailSent: email.sent,
    emailError: email.reason,
    // So staff can pass the link on while email is unconfigured.
    link,
  });
}
