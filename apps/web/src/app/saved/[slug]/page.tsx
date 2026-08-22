import Link from "next/link";

import { AuthControls } from "@/features/auth/components/auth-controls";
import { CollectionDetailView } from "@/features/collections/components/collection-detail-view";

export default async function OwnedCollectionPage({
  params,
}: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#28231f] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link className="font-extrabold text-[#315d50]" href="/saved">
            ← Bộ sưu tập
          </Link>
          <AuthControls />
        </header>
        <CollectionDetailView identifier={slug} owned />
      </div>
    </main>
  );
}
