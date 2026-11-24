export default function LiveIndicator({ connected }) {
  return (
    <span
      role="status"
      aria-label={connected ? "Live updates connected" : "Live updates disconnected"}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
        connected ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"
      }`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${connected ? "bg-green-700" : "bg-slate-500"}`} />
      Live
    </span>
  );
}
