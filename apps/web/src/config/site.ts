type Environment = Readonly<Record<string, string | undefined>>;

export function readSiteUrl(environment: Environment = process.env): string {
  const raw = environment.SITE_URL?.trim() || "http://localhost:3000";
  const url = new URL(raw);
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new Error("SITE_URL must use http or https");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("SITE_URL must not contain credentials or metadata");
  }
  return url.toString().replace(/\/$/, "");
}
