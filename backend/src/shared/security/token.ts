import { createHmac, timingSafeEqual } from 'node:crypto';

interface AuthTokenPayload {
  userId: number;
  userType: 'USER' | 'SUPERADMIN';
  exp: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf-8');
}

function sign(content: string, secret: string): string {
  return createHmac('sha256', secret).update(content).digest('base64url');
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_TOKEN_SECRET?.trim();
  if (secret && secret.length >= 24) {
    return secret;
  }

  if ((process.env.NODE_ENV ?? 'development') === 'production') {
    throw new Error('AUTH_TOKEN_SECRET must be configured in production with at least 24 chars');
  }

  return 'dev-only-secret-change-me-before-production';
}

function getAuthTokenTtlSeconds(): number {
  const raw = Number.parseInt(process.env.AUTH_TOKEN_TTL_SECONDS ?? '', 10);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  return 60 * 60 * 8;
}

export function createAuthToken(payload: Omit<AuthTokenPayload, 'exp'>): string {
  const body: AuthTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + getAuthTokenTtlSeconds(),
  };

  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = sign(encodedBody, getAuthSecret());
  return `${encodedBody}.${signature}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [encodedBody, signature] = token.split('.');
  if (!encodedBody || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedBody, getAuthSecret());
  const providedBuffer = Buffer.from(signature, 'utf-8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedBody)) as AuthTokenPayload;
    if (!payload?.userId || !payload?.userType || !payload?.exp) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
