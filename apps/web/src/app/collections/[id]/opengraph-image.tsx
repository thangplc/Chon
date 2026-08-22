import { ImageResponse } from "next/og";

import { loadPublicCollectionServer } from "@/features/collections/server/load-public-collection";

export const alt = "Bộ sưu tập địa điểm trên Chốn";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default async function OpenGraphImage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const collection = await loadPublicCollectionServer(id);
  const name = collection?.name ?? "Bộ sưu tập Chốn";
  const count = collection?.placeCount ?? 0;
  const places = collection?.places.slice(0, 3) ?? [];
  const label =
    collection?.ownerType === "editorial"
      ? "Chốn tuyển chọn"
      : "Bộ sưu tập công khai";

  return new ImageResponse(
    <div
      style={{
        background: "#f7f2eb",
        color: "#28231f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px 72px",
        width: "100%",
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
        <div
          style={{
            alignItems: "center",
            background: "#c96040",
            borderRadius: 999,
            color: "white",
            display: "flex",
            fontSize: 38,
            fontWeight: 800,
            height: 76,
            justifyContent: "center",
            width: 76,
          }}
        >
          C
        </div>
        <div style={{ fontSize: 42, fontWeight: 800 }}>Chốn</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            color: "#963f2a",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: name.length > 45 ? 54 : 68,
            fontWeight: 800,
            lineHeight: 1.08,
            maxWidth: 1020,
          }}
        >
          {name}
        </div>
        <div style={{ color: "#5e746a", fontSize: 28 }}>
          {count} địa điểm được chia sẻ trên Chốn
        </div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {places.map((place) => (
          <div
            key={place.slug}
            style={{
              background: "#fffdf9",
              border: "2px solid #ddd2c3",
              borderRadius: 18,
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 8,
              minWidth: 0,
              padding: "18px 22px",
            }}
          >
            <div
              style={{
                color: "#756c63",
                fontSize: 17,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {place.district}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {place.name}
            </div>
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}
