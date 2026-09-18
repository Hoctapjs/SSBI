import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSBI Receiver — PIF B13",
  description: "Endpoint tiếp nhận và hiển thị hồ sơ PIF do Odoo M08_P0801 đẩy sang ở bước B13.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
