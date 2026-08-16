export type ProviderPayload = Readonly<Record<string, unknown>>;

export function asProviderPayload(value: unknown): ProviderPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provider payload must be a JSON object");
  }
  return value as ProviderPayload;
}

export function readNumber(
  payload: ProviderPayload,
  key: string,
): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function readString(
  payload: ProviderPayload,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function readStringArray(
  payload: ProviderPayload,
  key: string,
): readonly string[] {
  const value = payload[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

export function hasValue(payload: ProviderPayload, key: string): boolean {
  return payload[key] !== undefined && payload[key] !== null;
}

export function signalId(providerPlaceId: string, signalType: string): string {
  return `${providerPlaceId}:${signalType}`;
}
