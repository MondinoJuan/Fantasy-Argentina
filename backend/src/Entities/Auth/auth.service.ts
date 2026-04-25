import crypto from 'node:crypto';

export function buildEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildEmailVerificationLink(token: string): string {
  const fallbackFrontend = 'http://localhost:4200';
  const frontendBaseUrl = process.env.FRONTEND_BASE_URL ?? fallbackFrontend;
  const separator = frontendBaseUrl.includes('?') ? '&' : '?';
  return `${frontendBaseUrl}/logIn${separator}verifyToken=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(mail: string, username: string, token: string): Promise<void> {
  const verificationLink = buildEmailVerificationLink(token);
  // Placeholder de envío real: en producción conectar con provider SMTP/transactional.
  console.log(`[email-verification] Send mail to ${mail} (${username}) -> ${verificationLink}`);
}

