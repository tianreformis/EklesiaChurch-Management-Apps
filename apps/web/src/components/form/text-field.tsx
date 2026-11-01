import { useId, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  error?: string;
  hint?: string;
}

/** Input dengan label besar dan pesan kesalahan dalam Bahasa Indonesia. */
export function TextField({ label, error, hint, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = `${inputId}-keterangan`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId} className="text-base font-semibold">
        {label}
      </Label>
      <Input
        id={inputId}
        className={cn('min-h-11 text-base', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? descriptionId : undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={descriptionId} className="text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
