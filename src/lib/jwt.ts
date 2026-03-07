import { SignJWT, jwtVerify } from 'jose';
import { SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES } from './config';

function getSecret() {
  if (!SECRET_KEY) {
    throw new Error('SECRET_KEY environment variable must be set in production');
  }
  return new TextEncoder().encode(SECRET_KEY);
}

export async function createAccessToken(
  data: Record<string, unknown>,
  expiresInMinutes = ACCESS_TOKEN_EXPIRE_MINUTES,
): Promise<string> {
  return new SignJWT(data)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresInMinutes}m`)
    .sign(getSecret());
}

export async function createAdminToken(adminId: string): Promise<string> {
  return createAccessToken({ sub: adminId, role: 'admin' });
}

export async function verifyToken(token: string): Promise<Record<string, unknown>> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as Record<string, unknown>;
}

export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
