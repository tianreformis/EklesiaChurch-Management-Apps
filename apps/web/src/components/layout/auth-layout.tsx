import { APP_NAME } from '@eklesia/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Tata letak halaman publik: masuk, undangan, dan atur ulang password. */
export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/masuk" className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-xl bg-primary text-xl font-black text-primary-foreground"
            >
              E
            </span>
            <span className="text-xl font-bold">{APP_NAME}</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-lg text-muted-foreground">{description}</p>
        </div>
        {children}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <p>{APP_NAME} — aplikasi manajemen gereja.</p>
        </div>
      </footer>
    </div>
  );
}
