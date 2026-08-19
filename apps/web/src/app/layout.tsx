import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "maplibre-gl/dist/maplibre-gl.css";

import "./globals.css";

export const metadata: Metadata = {
  description:
    "Khám phá quán cà phê phù hợp với tâm trạng, mục đích và thời điểm.",
  title: {
    default: "Chốn",
    template: "%s · Chốn",
  },
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
  modal: ReactNode;
}>;

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html lang="vi">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
