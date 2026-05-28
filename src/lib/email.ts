import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return cachedTransporter;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const info = await getTransporter().sendMail({
    from: `"${env.FROM_NAME}" <${env.FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });
  return info;
}
