import VibeClient from "./VibeClient";

export const dynamic = "force-dynamic";

export default function VibePage({ params }: { params: { id: string } }) {
  return <VibeClient id={params.id} />;
}
