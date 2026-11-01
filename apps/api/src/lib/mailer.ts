import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from 'pino';
import type { Env } from './env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  /** True bila SMTP dikonfigurasi; UI menampilkan tautan manual bila false. */
  readonly isConfigured: boolean;
  send(message: MailMessage): Promise<void>;
}

class SmtpMailer implements Mailer {
  readonly isConfigured = true;

  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}

/**
 * Dipakai saat SMTP belum diatur (umum untuk gereja kecil). Tidak mencetak isi
 * email ke log karena memuat token undangan; admin mengirim tautan manual.
 */
class ManualMailer implements Mailer {
  readonly isConfigured = false;

  constructor(private readonly logger: Logger) {}

  async send(): Promise<void> {
    this.logger.info('Email tidak dikirim karena SMTP belum dikonfigurasi');
  }
}

export function createMailer(env: Env, logger: Logger): Mailer {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    return new ManualMailer(logger);
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  return new SmtpMailer(transporter, env.SMTP_FROM);
}
