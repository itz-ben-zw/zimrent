const nodemailer = require('nodemailer');

/* ============================================================
   Email service (SMTP via nodemailer)
   Configure with env vars: SMTP_HOST, SMTP_PORT, SMTP_USER,
   SMTP_PASS, SMTP_FROM (optional; defaults to SMTP_USER).
   Without configuration, sendX() returns false and logs a
   warning - callers decide whether that is fatal.
   ============================================================ */

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/+$/, '');
}

function getTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

function layout(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:2rem 1rem;">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e3e8f2;overflow:hidden;">
      <tr><td style="background:#1B2A4A;padding:1.2rem 2rem;">
        <span style="font-size:1.3rem;font-weight:bold;color:#ffffff;">Homi<span style="color:#8FA8D8;">fy</span></span>
      </td></tr>
      <tr><td style="padding:2rem;">
        <h2 style="margin:0 0 1rem;color:#1B2A4A;font-size:1.2rem;">${title}</h2>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:1rem 2rem;border-top:1px solid #e3e8f2;color:#8a93a6;font-size:0.78rem;">
        Homify - student accommodation near NUST, Bulawayo. If you didn't request this, you can safely ignore this email.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function button(url, label) {
  return `<p style="margin:1.5rem 0;"><a href="${url}" style="display:inline-block;background:#1B2A4A;color:#ffffff;text-decoration:none;padding:0.8rem 1.6rem;border-radius:8px;font-weight:bold;">${label}</a></p>
  <p style="color:#6b7280;font-size:0.85rem;word-break:break-all;">Or paste this link into your browser:<br><a href="${url}" style="color:#1B2A4A;">${url}</a></p>`;
}

async function sendVerificationEmail(to, fullName, token) {
  if (!isConfigured()) {
    console.warn('[EMAIL] Verification email skipped: SMTP_HOST/SMTP_USER/SMTP_PASS not configured.');
    return false;
  }
  const url = `${getFrontendUrl()}/verify-email.html?token=${encodeURIComponent(token)}`;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Verify your Homify email',
      html: layout(
        `Welcome${fullName ? ', ' + fullName : ''}!`,
        `<p style="color:#374151;">Confirm your email address to activate your Homify account. This link expires in 24 hours.</p>${button(url, 'Verify my email')}`
      )
    });
    console.log(`[EMAIL] Verification email sent to ${to}`);
    return true;
  } catch (err) {
    console.warn(`[EMAIL] Verification email failed for ${to}:`, err.message);
    return false;
  }
}

async function sendPasswordResetEmail(to, token) {
  if (!isConfigured()) {
    console.warn('[EMAIL] Password reset email skipped: SMTP_HOST/SMTP_USER/SMTP_PASS not configured.');
    return false;
  }
  const url = `${getFrontendUrl()}/forgot-password.html?token=${encodeURIComponent(token)}`;
  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Reset your Homify password',
      html: layout(
        'Reset your password',
        `<p style="color:#374151;">We received a request to reset your Homify password. The link below expires in 1 hour and can only be used once.</p>${button(url, 'Choose a new password')}`
      )
    });
    console.log(`[EMAIL] Password reset email sent to ${to}`);
    return true;
  } catch (err) {
    console.warn(`[EMAIL] Password reset email failed for ${to}:`, err.message);
    return false;
  }
}

module.exports = { isConfigured, sendVerificationEmail, sendPasswordResetEmail };