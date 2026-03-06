import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { SessionService } from '@/lib/services/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await getAuthenticatedUser(req);
  if (error) return error;

  const { id } = await params;

  // Verify the session belongs to this user
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing || existing.userId !== user!.id) {
    return NextResponse.json({ detail: 'Session not found' }, { status: 404 });
  }

  const { doorClosed, chargerDisconnected } = await req.json();
  const svc = new SessionService(prisma);
  try {
    const session = await svc.endSession(id, doorClosed, chargerDisconnected);
    return NextResponse.json({
      id: session.id,
      endAt: session.endAt,
      durationMins: session.durationMins,
      cost: session.cost,
      isPaid: session.isPaid,
    });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 400 });
  }
}
