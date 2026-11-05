import type { Mailer } from './mailer.js';

export interface ReminderContext {
  nama: string;
  peran: string;
  ibadah: string;
  tanggal: string;
  jam: string;
  lokasi: string;
}

/** Mengganti placeholder {nama}, {peran}, {ibadah}, {tanggal}, {jam}, {lokasi}. */
export function renderTemplate(body: string, context: ReminderContext): string {
  return body
    .replaceAll('{nama}', context.nama)
    .replaceAll('{peran}', context.peran)
    .replaceAll('{ibadah}', context.ibadah)
    .replaceAll('{tanggal}', context.tanggal)
    .replaceAll('{jam}', context.jam)
    .replaceAll('{lokasi}', context.lokasi);
}

/**
 * Saluran pengingat pelayanan. MVP memakai tautan wa.me yang diklik pengurus
 * dan email lewat SMTP; WhatsApp API resmi dapat ditambah sebagai
 * implementasi baru tanpa mengubah pemanggil.
 */
export interface Notifier {
  readonly channel: 'whatsapp' | 'email';
  /** Menyiapkan pesan untuk satu penerima; `waLink` terisi untuk WhatsApp. */
  prepare(input: {
    phone: string | null;
    email: string | null;
    text: string;
  }): Promise<{ waLink: string | null; emailSent: boolean }>;
}

/** Mengubah nomor lokal menjadi format internasional untuk wa.me. */
export function toWaNumber(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) {
    return null;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

export class WaLinkNotifier implements Notifier {
  readonly channel = 'whatsapp' as const;

  async prepare(input: { phone: string | null; email: string | null; text: string }): Promise<{
    waLink: string | null;
    emailSent: boolean;
  }> {
    if (!input.phone) {
      return { waLink: null, emailSent: false };
    }
    const number = toWaNumber(input.phone);
    if (!number) {
      return { waLink: null, emailSent: false };
    }
    return {
      waLink: `https://wa.me/${number}?text=${encodeURIComponent(input.text)}`,
      emailSent: false,
    };
  }
}

export class EmailNotifier implements Notifier {
  readonly channel = 'email' as const;

  constructor(private readonly mailer: Mailer) {}

  async prepare(input: {
    phone: string | null;
    email: string | null;
    text: string;
  }): Promise<{ waLink: string | null; emailSent: boolean }> {
    if (!input.email) {
      return { waLink: null, emailSent: false };
    }
    if (!this.mailer.isConfigured) {
      return { waLink: null, emailSent: false };
    }
    await this.mailer.send({
      to: input.email,
      subject: 'Pengingat tugas pelayanan',
      text: input.text,
    });
    return { waLink: null, emailSent: true };
  }
}
