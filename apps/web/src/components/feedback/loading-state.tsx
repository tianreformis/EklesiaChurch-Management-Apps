export function LoadingState({ label = 'Memuat halaman...' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 py-10">
      <p className="text-lg font-semibold">{label}</p>
      <p className="text-base text-muted-foreground">Mohon tunggu sebentar.</p>
    </div>
  );
}
