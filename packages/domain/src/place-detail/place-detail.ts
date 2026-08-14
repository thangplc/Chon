// Transport-agnostic Place Detail contract and media provenance helpers.
export type PlaceDetailMedia = Readonly<{
  altText: string;
  height: number;
  id: string;
  isSimulated: boolean;
  sortOrder: number;
  sourceLabel: string;
  sourceReference: string | null;
  url: string;
  width: number;
}>;

export type PlaceDetail = Readonly<{
  address: string;
  description: string | null;
  district: string;
  id: string;
  isSimulated: boolean;
  latitude: number;
  longitude: number;
  media: readonly PlaceDetailMedia[];
  name: string;
  slug: string;
}>;

export function resolvePlaceMediaUrl(input: {
  sourceUrl: string | null;
  storageKey: string | null;
}): string {
  if (input.storageKey) {
    const storageKey = input.storageKey.trim();
    if (
      storageKey.startsWith("/") ||
      storageKey.split("/").some((segment) => segment === "..")
    ) {
      throw new Error("Invalid place media storage key");
    }
    return `/${storageKey}`;
  }

  if (input.sourceUrl) return new URL(input.sourceUrl).toString();
  throw new Error("Place media has no display location");
}

export function mediaSourceLabel(sourceType: string): string {
  if (sourceType === "synthetic") return "Minh họa giả lập của Chốn";
  if (sourceType === "editorial") return "Nhóm Chốn";
  if (sourceType === "community") return "Cộng đồng Chốn";
  return "Đối tác cung cấp dữ liệu";
}
