const defaultMapTilerStyleId = "streets-v4";
const mapTilerStyleIdPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;

export type PublicMapConfiguration = Readonly<{
  styleUrl: string | null;
}>;

type MapEnvironment = Readonly<Record<string, string | undefined>>;

export function getPublicMapConfiguration(
  environment: MapEnvironment = process.env,
): PublicMapConfiguration {
  const apiKey = environment.NEXT_PUBLIC_MAPTILER_API_KEY?.trim();
  const requestedStyleId = environment.NEXT_PUBLIC_MAPTILER_STYLE_ID?.trim();
  const styleId = requestedStyleId || defaultMapTilerStyleId;

  if (!apiKey || !mapTilerStyleIdPattern.test(styleId)) {
    return { styleUrl: null };
  }

  return {
    styleUrl: `https://api.maptiler.com/maps/${styleId}/style.json?key=${encodeURIComponent(apiKey)}`,
  };
}
