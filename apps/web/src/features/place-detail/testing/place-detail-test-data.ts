import type { PlaceDetail } from "../domain/place-detail";

export const placeDetailTestData: PlaceDetail = {
  address: "12 Đường Test",
  description: null,
  district: "Quận 3",
  id: "test-place-id",
  isSimulated: true,
  latitude: 10.78,
  longitude: 106.687,
  media: [
    {
      altText: "Góc cửa sổ thử nghiệm",
      height: 800,
      id: "test-media-1",
      isSimulated: true,
      sortOrder: 0,
      sourceLabel: "Minh họa giả lập của Chốn",
      sourceReference: "test-seed-v1",
      url: "/place-media/synthetic/cafe-window.svg",
      width: 1200,
    },
    {
      altText: "Góc đọc sách thử nghiệm",
      height: 800,
      id: "test-media-2",
      isSimulated: true,
      sortOrder: 1,
      sourceLabel: "Minh họa giả lập của Chốn",
      sourceReference: "test-seed-v1",
      url: "/place-media/synthetic/cafe-reading.svg",
      width: 1200,
    },
  ],
  name: "Góc Test",
  slug: "goc-test",
};
