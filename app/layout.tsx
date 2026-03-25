import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G空間情報センター 検索",
  description: "自然言語でG空間情報センターのデータセットを検索",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
