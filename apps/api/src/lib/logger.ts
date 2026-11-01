import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';

/**
 * Field yang tidak boleh masuk log (UU PDP): kontak pribadi, nominal, kredensial.
 * Redaksi dilakukan di level logger sehingga pemanggil tidak perlu ingat.
 */
export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'sessionToken',
  '*.sessionToken',
  'phone',
  '*.phone',
  'email',
  '*.email',
  'amount',
  '*.amount',
  'nominal',
  '*.nominal',
  'DATABASE_URL',
  '*.DATABASE_URL',
];

export interface LoggerOptionsInput {
  level: string;
  appName: string;
  /** Tampilkan log ramah manusia (hanya untuk development). */
  pretty?: boolean;
  /** Tujuan kustom, dipakai test. */
  destination?: DestinationStream;
}

export function createLogger(options: LoggerOptionsInput): Logger {
  const base: LoggerOptions = {
    level: options.level,
    base: { app: options.appName },
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
  };

  if (options.destination) {
    return pino(base, options.destination);
  }

  if (options.pretty) {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      },
    });
  }

  return pino(base);
}
