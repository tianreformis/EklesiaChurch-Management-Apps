export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/** Kesalahan API yang membawa kode, pesan, dan kesalahan per field. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'REQUEST_ERROR',
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK = 'Terjadi kesalahan. Silakan coba lagi.';

/** Mengubah respons gagal menjadi `ApiError` yang siap ditampilkan. */
export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorPayload;
    return new ApiError(
      response.status,
      body.error?.message ?? FALLBACK,
      body.error?.code ?? 'REQUEST_ERROR',
      body.error?.fields ?? {},
    );
  } catch {
    return new ApiError(response.status, FALLBACK);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : FALLBACK;
}
