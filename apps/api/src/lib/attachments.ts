import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { badRequest } from './errors.js';

/** Lampiran bukti: hanya gambar/PDF, maks 2 MB, tipe dari isi berkas. */
export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

interface DetectedType {
  extension: string;
  contentType: string;
}

/** Mengenali tipe dari magic bytes, bukan dari nama/ekstensi kiriman klien. */
export function detectAttachmentType(buffer: Buffer): DetectedType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { extension: 'png', contentType: 'image/png' };
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return { extension: 'pdf', contentType: 'application/pdf' };
  }
  return null;
}

/** Menyimpan lampiran dengan nama acak di folder volume; mengembalikan namanya. */
export async function saveAttachment(dir: string, buffer: Buffer): Promise<string> {
  if (buffer.length === 0) {
    throw badRequest('Berkas lampiran kosong.');
  }
  if (buffer.length > ATTACHMENT_MAX_BYTES) {
    throw badRequest('Lampiran terlalu besar. Maksimal 2 MB.');
  }
  const detected = detectAttachmentType(buffer);
  if (!detected) {
    throw badRequest('Lampiran harus berupa gambar (JPG/PNG) atau PDF.');
  }
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${detected.extension}`;
  await writeFile(join(dir, filename), buffer);
  return filename;
}

/** Membaca lampiran yang pernah disimpan; nama dibersihkan dari path traversal. */
export async function readAttachment(
  dir: string,
  filename: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeName = basename(filename);
  if (safeName !== filename || !/^[a-zA-Z0-9._-]+$/.test(safeName)) {
    return null;
  }
  try {
    const buffer = await readFile(join(dir, safeName));
    const detected = detectAttachmentType(buffer);
    return { buffer, contentType: detected?.contentType ?? 'application/octet-stream' };
  } catch {
    return null;
  }
}
