import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conversational AI — PromptAds SDK Test",
  description: "Test PromptAds SDK ad injection in a real AI chatbot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
