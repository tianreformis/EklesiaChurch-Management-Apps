import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Pesan kesalahan yang konsisten dan mudah dibaca. */
export function ErrorAlert({ message, title = 'Ada yang perlu diperbaiki' }: { message: string; title?: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
