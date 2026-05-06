// Centered full-screen spinner.
//
// Shared between Suspense fallbacks for lazy-loaded routes (App.jsx) and
// per-page initial loading states (RootRoute, SupabaseAuth, etc.) so all of
// them stay visually consistent.
export default function FullScreenSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );
}
