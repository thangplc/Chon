import type { Metadata } from "next";
import type { ReactNode } from "react";

import "maplibre-gl/dist/maplibre-gl.css";

import { AuthControls } from "@/features/auth/components/auth-controls";

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
        <AuthControls />
        {children}
        {modal}
      </body>
    </html>
  );
}
