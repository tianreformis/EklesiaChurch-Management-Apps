import { zValidator } from '@hono/zod-validator';
import type { z } from 'zod';

export interface ValidationErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/**
 * Validator bersama: mengubah kegagalan Zod menjadi pesan Bahasa Indonesia dan
 * peta kesalahan per field agar form bisa menandai input yang salah.
 */
export function jsonBody<TSchema extends z.ZodType>(schema: TSchema) {
  return zValidator('json', schema, (result, c) => {
    if (result.success) {
      return undefined;
    }
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'form';
      fields[key] ??= issue.message;
    }
    const body: ValidationErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Periksa kembali data yang diisi.',
        fields,
      },
    };
    return c.json(body, 400);
  });
}

export function queryParams<TSchema extends z.ZodType>(schema: TSchema) {
  return zValidator('query', schema, (result, c) => {
    if (result.success) {
      return undefined;
    }
    const body: ValidationErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: result.error.issues[0]?.message ?? 'Parameter tidak valid.',
      },
    };
    return c.json(body, 400);
  });
}

export function pathParams<TSchema extends z.ZodType>(schema: TSchema) {
  return zValidator('param', schema, (result, c) => {
    if (result.success) {
      return undefined;
    }
    const body: ValidationErrorBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: result.error.issues[0]?.message ?? 'Alamat tidak valid.',
      },
    };
    return c.json(body, 400);
  });
}
