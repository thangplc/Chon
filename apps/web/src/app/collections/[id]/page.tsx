import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { readSiteUrl } from "@/config/site";
import { CollectionDetailView } from "@/features/collections/components/collection-detail-view";
import { loadPublicCollectionServer } from "@/features/collections/server/load-public-collection";

type PageProps = Readonly<{ params: Promise<{ id: string }> }>;

function descriptionFor(
  name: string,
  description: string | null,
  count: number,
) {
  return (
    description ??
    `Khám phá ${count} địa điểm trong bộ sưu tập “${name}” được chia sẻ trên Chốn.`
  );
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const collection = await loadPublicCollectionServer(id);
  if (!collection) {
    return {
      robots: { follow: false, index: false },
      title: "Không tìm thấy bộ sưu tập",
    };
  }
  const siteUrl = readSiteUrl();
  const canonical = `${siteUrl}/collections/${collection.id}`;
  const description = descriptionFor(
    collection.name,
    collection.description,
    collection.placeCount,
  );
  return {
    alternates: { canonical },
    description,
    openGraph: {
      description,
      images: [
        {
          alt: `Bộ sưu tập ${collection.name} trên Chốn`,
          height: 630,
          url: `${canonical}/opengraph-image`,
          width: 1200,
        },
      ],
      siteName: "Chốn",
      title: collection.name,
      type: "website",
      url: canonical,
    },
    title: collection.name,
    twitter: {
      card: "summary_large_image",
      description,
      images: [`${canonical}/opengraph-image`],
      title: collection.name,
    },
  };
}

export default async function PublicCollectionPage({ params }: PageProps) {
  const { id } = await params;
  const collection = await loadPublicCollectionServer(id);
  if (!collection) notFound();

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-5 text-[#28231f] sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-[#ddd2c3] pb-5">
          <Link className="flex items-center gap-2.5 font-extrabold" href="/">
            <span className="grid size-10 place-items-center rounded-full bg-[#c96040] text-xl text-white">
              C
            </span>
            <span className="text-xl">Chốn</span>
          </Link>
          <Link
            className="rounded-full border border-[#ddd2c3] bg-white px-4 py-2 text-sm font-bold"
            href="/"
          >
            Khám phá Chốn
          </Link>
        </header>
        <CollectionDetailView
          identifier={id}
          initialCollection={collection}
          owned={false}
        />
      </div>
    </main>
  );
}
