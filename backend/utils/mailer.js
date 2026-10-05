const nodemailer = require('nodemailer');

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

// Test-only inspection hook — CI/tests have no real SMTP credentials, so we
// record what would have been sent instead of actually sending it.
let lastTestEmail = null;

/**
 * Emails a password-reset link to a user.
 * @param {string} toEmail
 * @param {string} resetUrl
 */
const sendPasswordResetEmail = async (toEmail, resetUrl) => {
  if (process.env.NODE_ENV === 'test') {
    lastTestEmail = { to: toEmail, resetUrl };
    return;
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP_USER/SMTP_PASS are not configured — cannot send password reset email.');
    return;
  }

  await getTransporter().sendMail({
    from: `"Kutumb" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Reset your Kutumb password',
    html: `
      <p>Someone requested a password reset for your Kutumb account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> — this link expires in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });
};

module.exports = {
  sendPasswordResetEmail,
  _testGetLastEmail: () => lastTestEmail,
};
