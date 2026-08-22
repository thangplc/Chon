export type PlaceIdentity = Readonly<{
  latitude: number;
  longitude: number;
  name: string;
}>;

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLocaleLowerCase("vi")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function normalizedPlaceName(value: string): string {
  return normalizeName(value);
}

export function placeNamesAreSimilar(left: string, right: string): boolean {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  const maximumLength = Math.max(normalizedLeft.length, normalizedRight.length);
  if (maximumLength === 0) return true;
  return (
    1 - editDistance(normalizedLeft, normalizedRight) / maximumLength >= 0.8
  );
}

export function placeDistanceMeters(
  left: Pick<PlaceIdentity, "latitude" | "longitude">,
  right: Pick<PlaceIdentity, "latitude" | "longitude">,
): number {
  const earthRadius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function arePotentialDuplicatePlaces(
  left: PlaceIdentity,
  right: PlaceIdentity,
  thresholdMeters = 30,
): boolean {
  return (
    placeDistanceMeters(left, right) <= thresholdMeters &&
    (placeNamesAreSimilar(left.name, right.name) ||
      (left.latitude === right.latitude && left.longitude === right.longitude))
  );
}
