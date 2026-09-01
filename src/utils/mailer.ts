/**
 * src/utils/mailer.ts
 *
 * Mail utility for sending transactional emails (e.g. Organizer KYC Approval, Notifications)
 * Supports Gmail SMTP with App Password and graceful fallback logging.
 */

import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (env.SMTP_USER && env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
    logger.info(`[Mailer] SMTP Transporter configured for user: ${env.SMTP_USER}`);
  }

  return transporter;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendMailOptions): Promise<boolean> {
  const mailer = getTransporter();

  if (!mailer) {
    logger.info(
      `[Mailer Simulated] To: ${options.to} | Subject: "${options.subject}" (Configure SMTP_USER and SMTP_PASS in .env to send real Gmail emails)`
    );
    console.log(
      `\n==================== [SIMULATED EMAIL TO: ${options.to}] ====================\n` +
      `Subject: ${options.subject}\n` +
      `Body Preview: ${options.text || options.html.replace(/<[^>]*>?/gm, '').slice(0, 300)}...\n` +
      `============================================================================\n`
    );
    return true;
  }

  try {
    const info = await mailer.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    logger.info(`[Mailer] Email sent successfully to ${options.to}. MessageId: ${info.messageId}`);
    return true;
  } catch (err: any) {
    logger.error(`[Mailer Error] Failed to send email to ${options.to}: ${err.message}`);
    return false;
  }
}

export async function sendOrganizerApprovalEmail(organizerEmail: string, organizerName: string, companyName?: string): Promise<boolean> {
  const subject = '🎉 Selamat! Pendaftaran Akun Organizer WhiteLabel Anda Telah Disetujui';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 36px 32px; text-align: center; color: white; }
        .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; }
        .content { padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }
        .highlight-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px; margin: 20px 0; text-align: center; }
        .highlight-box strong { color: #166534; font-size: 15px; display: block; margin-bottom: 4px; }
        .button { display: inline-block; background: #4f46e5; color: white !important; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; margin-top: 10px; text-align: center; }
        .footer { padding: 20px 32px; background: #f8fafc; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>WhiteLabel Ticketing</h1>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">Pemberitahuan Verifikasi Akun Organizer</p>
        </div>
        <div class="content">
          <p>Halo <strong>${organizerName}</strong>${companyName ? ` (${companyName})` : ''},</p>
          <p>Kabar gembira! Tim Super Admin WhiteLabel telah meninjau dan <strong>menyetujui permohonan legalitas (KYC)</strong> akun Organizer Anda.</p>
          
          <div class="highlight-box">
            <strong>✓ Status Akun: Terverifikasi (Approved)</strong>
            <span style="color: #15803d; font-size: 13px;">Sekarang Anda memiliki akses penuh untuk membuat dan mengelola event ticketing.</span>
          </div>

          <p>Fitur yang kini dapat Anda akses:</p>
          <ul>
            <li>Membuat event baru, mengatur jadwal &amp; venue map</li>
            <li>Mengatur kategori tier tiket &amp; kuota penjualan</li>
            <li>Mengatur jadwal buka antrean tiket (Sale Schedule)</li>
            <li>Menugaskan akun Gate Staff &amp; Vendor Kasir Booth</li>
            <li>Menerbitkan kode promo &amp; memantau analitik real-time</li>
          </ul>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${env.CORS_ORIGIN}/login" class="button">Masuk ke Organizer Dashboard &rarr;</a>
          </div>

          <p style="font-size: 12px; color: #64748b;">Jika tombol di atas tidak berfungsi, buka URL berikut di browser Anda:<br>
          <a href="${env.CORS_ORIGIN}/login" style="color: #4f46e5;">${env.CORS_ORIGIN}/login</a></p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} WhiteLabel Event Ticketing SaaS. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: organizerEmail,
    subject,
    html,
    text: `Halo ${organizerName}, pendaftaran akun Organizer WhiteLabel Anda telah disetujui oleh Super Admin. Silakan login di ${env.CORS_ORIGIN}/login`,
  });
}
