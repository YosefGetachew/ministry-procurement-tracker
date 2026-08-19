const fs = require('fs/promises');
const path = require('path');
const nodemailer = require('nodemailer');

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function transport() {
  if (smtpConfigured()) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return nodemailer.createTransport({ streamTransport: true, newline: 'windows', buffer: true });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

async function sendCommitteeInvitation({ name, email, committeeType, temporaryPassword }) {
  const committeeName = committeeType === 'endorsing' ? 'Endorsing Committee' : 'Ministry Management Committee';
  const loginUrl = process.env.APP_LOGIN_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeCommitteeName = escapeHtml(committeeName);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safePassword = escapeHtml(temporaryPassword);
  const message = {
    from: process.env.MAIL_FROM || 'MoA Procurement Tracking System <no-reply@moa.gov.et>',
    to: email,
    subject: `Your ${committeeName} account`,
    text: [
      `Dear ${name},`, '',
      `You have been registered as a member of the ${committeeName} in the Ministry of Agriculture Procurement Tracking System.`, '',
      `Login: ${loginUrl}`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`, '',
      'You must change this temporary password immediately after your first sign-in.', '',
      'Ministry of Agriculture Procurement Tracking System',
    ].join('\n'),
    html: `<p>Dear ${safeName},</p><p>You have been registered as a member of the <strong>${safeCommitteeName}</strong> in the Ministry of Agriculture Procurement Tracking System.</p><p><strong>Login:</strong> <a href="${safeLoginUrl}">${safeLoginUrl}</a><br><strong>Email:</strong> ${safeEmail}<br><strong>Temporary password:</strong> ${safePassword}</p><p>You must change this temporary password immediately after your first sign-in.</p><p>Ministry of Agriculture Procurement Tracking System</p>`,
  };
  const info = await transport().sendMail(message);
  if (smtpConfigured()) return { mode: 'smtp', messageId: info.messageId };

  const outbox = path.join(__dirname, 'outbox');
  await fs.mkdir(outbox, { recursive: true });
  const safeFilenameEmail = email.replace(/[^a-z0-9@._-]/gi, '_');
  const filename = `${Date.now()}-${safeFilenameEmail}.eml`;
  await fs.writeFile(path.join(outbox, filename), info.message);
  return { mode: 'outbox', filename };
}

module.exports = { sendCommitteeInvitation, smtpConfigured };
