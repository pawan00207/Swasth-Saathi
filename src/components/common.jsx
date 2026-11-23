"use client";

export function FilterChips({ items, active, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button key={item} type="button" aria-pressed={active === item} onClick={() => onChange(item)}
          className={`rounded-full border px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700 ${active === item ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white"}`}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-bold">{title}</h2>{children && <p className="mt-2 text-slate-600">{children}</p>}</section>;
}

export function LoadingSkeleton() {
  return <div className="animate-pulse space-y-3" aria-label="Loading"><div className="h-20 rounded bg-slate-200"/><div className="h-20 rounded bg-slate-200"/></div>;
}

export function ErrorBanner({ children }) {
  return <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-900">{children}</div>;
}
