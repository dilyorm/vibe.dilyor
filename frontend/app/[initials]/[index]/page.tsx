import { redirect } from "next/navigation";

// Resolve the vanity URL server-side and redirect to the canonical /vibe/{id}
// page. Fetches from the backend proxy and hands the id to the existing
// VibeClient. If the handle doesn't resolve, render a small 404.
export default async function HandlePage({
  params,
}: {
  params: Promise<{ initials: string; index: string }>;
}) {
  const { initials, index } = await params;
  const n = parseInt(index, 10);
  if (!/^[a-z0-9]{1,8}$/.test(initials) || isNaN(n)) {
    return <NotFound />;
  }

  const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/api/handle/${initials}/${n}`, {
      cache: "no-store",
    });
    if (!res.ok) return <NotFound />;
    const v = await res.json();
    if (!v?.id) return <NotFound />;
    redirect(`/vibe/${v.id}`);
  } catch {
    return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="min-h-[70vh] grid place-items-center px-6 text-center">
      <div>
        <p className="opacity-70 mb-4">this vibe isn&apos;t here.</p>
        <a href="/" className="underline underline-offset-4">go home</a>
      </div>
    </div>
  );
}
