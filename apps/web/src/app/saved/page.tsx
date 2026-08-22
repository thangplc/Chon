import type { Metadata } from "next";
import Link from "next/link";

import { AuthControls } from "@/features/auth/components/auth-controls";
import { SavedPlacesView } from "@/features/collections/components/saved-places-view";

export const metadata: Metadata = { title: "Bộ sưu tập" };

export default function SavedPlacesPage() {
  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#28231f] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4">
          <Link className="font-extrabold text-[#315d50]" href="/">
            ← Explore
          </Link>
          <AuthControls />
        </header>
        <section className="mt-10">
          <p className="text-xs font-extrabold tracking-[0.12em] text-[#963f2a] uppercase">
            Bộ sưu tập của bạn
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">
            Bộ sưu tập
          </h1>
          <div className="mt-6">
            <SavedPlacesView />
          </div>
        </section>
      </div>
    </main>
  );
}
