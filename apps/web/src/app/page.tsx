import { Suspense } from "react";
import { connection } from "next/server";

import { getPublicMapConfiguration } from "@/config/map";
import { AuthControls } from "@/features/auth/components/auth-controls";
import { ExploreExperience } from "@/features/explore/components/explore-experience";
import {
  getExploreDataset,
  getExploreServiceAreas,
} from "@/features/explore/data/explore-repository";

async function ExploreFromDatabase() {
  await connection();
  const [dataset, serviceAreas] = await Promise.all([
    getExploreDataset(),
    getExploreServiceAreas(),
  ]);
  const mapConfiguration = getPublicMapConfiguration();

  return (
    <ExploreExperience
      authControls={<AuthControls />}
      dataset={dataset}
      mapStyleUrl={mapConfiguration.styleUrl}
      serviceAreas={serviceAreas}
    />
  );
}

function ExploreLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3efe5] px-6 text-center text-[#18352d]">
      <div>
        <p className="text-sm font-bold tracking-[0.14em] uppercase">Chốn</p>
        <p className="mt-2 text-sm text-[#5e746a]">
          Đang đọc dữ liệu Explore từ PostgreSQL…
        </p>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<ExploreLoading />}>
      <ExploreFromDatabase />
    </Suspense>
  );
}
