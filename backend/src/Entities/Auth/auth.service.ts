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
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromMail = process.env.VERIFICATION_EMAIL_FROM ?? 'Fantasy Argentina <onboarding@resend.dev>';

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin-bottom: 8px;">¡Hola, ${username}!</h2>
      <p>Para activar tu cuenta de Fantasy Argentina, verificá tu email haciendo clic en el botón:</p>
      <p style="margin: 24px 0;">
        <a href="${verificationLink}" style="background:#0ea5e9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">
          Verificar mi cuenta
        </a>
      </p>
      <p>Si el botón no funciona, copiá y pegá este enlace en tu navegador:</p>
      <p><a href="${verificationLink}">${verificationLink}</a></p>
    </div>
  `;

  if (!resendApiKey) {
    console.log(`[email-verification] RESEND_API_KEY no configurada. Link para ${mail}: ${verificationLink}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromMail,
      to: [mail],
      subject: 'Verificá tu cuenta de Fantasy Argentina',
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`No se pudo enviar el mail de verificación: ${response.status} ${errorBody}`);
  }
}
