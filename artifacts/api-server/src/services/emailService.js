const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return transporter;
  }

  // No SMTP configured — use console fallback
  return null;
}

async function sendVerificationCode(email, code) {
  const t = getTransporter();

  const subject = 'AquaTrack — Your Login Verification Code';
  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 28px;">💧</span>
        <h1 style="font-size: 22px; color: #1e293b; margin: 8px 0 0;">AquaTrack</h1>
      </div>
      <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 28px;">
        <p style="color: #475569; margin: 0 0 16px;">Enter this verification code to complete your login. It expires in <strong>5 minutes</strong>.</p>
        <div style="text-align: center; padding: 20px; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #1d4ed8;">${code}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  if (!t) {
    // Development fallback — print to console
    console.log('\n==========================================================');
    console.log(`[EMAIL] To: ${email}`);
    console.log(`[EMAIL] Subject: ${subject}`);
    console.log(`[EMAIL] Verification Code: ${code}`);
    console.log('==========================================================\n');
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || `"AquaTrack" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
  });
}

module.exports = { sendVerificationCode };
