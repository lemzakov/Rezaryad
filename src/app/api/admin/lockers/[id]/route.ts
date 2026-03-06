import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthenticatedAdmin } from '@/lib/server-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getAuthenticatedAdmin(req);
  if (error) return error;

  const { id } = await params;
  const locker = await prisma.locker.findUnique({ where: { id } });
  if (!locker) return NextResponse.json({ detail: 'Locker not found' }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.address !== undefined) data.address = body.address;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.locker.update({ where: { id }, data });
  return NextResponse.json({ id: updated.id, name: updated.name, isActive: updated.isActive });
}
