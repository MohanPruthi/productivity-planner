// Sends verification codes through the Resend HTTP API (no SMTP needed).
// Without RESEND_API_KEY the code is written to the server log instead.
async function sendVerificationCode(email, code, purpose) {
  const subject = purpose === 'pin'
    ? 'Your workspace PIN reset code'
    : 'Your password reset code';
  const text = `Your verification code is ${code}. It expires in 15 minutes.\n\nIf you didn't request this, ignore this email.`;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[mailer] RESEND_API_KEY not set. ${purpose} reset code for ${email}: ${code}`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Productivity Planner <onboarding@resend.dev>',
      to: [email],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

module.exports = { sendVerificationCode };
