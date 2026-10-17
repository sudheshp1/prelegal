export default function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xl font-bold ${inverted ? "text-white" : "text-brand-navy"}`}>
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-brand-yellow text-sm text-brand-navy">
        P
      </span>
      Prelegal
    </span>
  );
}
