import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PLIRIS Social Review Hub",
  description: "Private social content review and version-specific approvals.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
