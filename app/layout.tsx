import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Clipdexer — Find the moment",
  description:
    "You remember the moment. We find the clip. Search speech, scenes, and everything in between.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
