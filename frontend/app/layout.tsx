import type { Metadata } from "next";
import "./globals.css";
import TopProgressBar from "@/components/ui/TopProgressBar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "PetaniKita — Platform Rantai Pasok Pangan Hiperlokal",
  description:
    "Menghubungkan Petani dan UMKM Kuliner secara langsung (<50 km) untuk harga adil dan bahan baku segar.",
  applicationName: "PetaniKita",
  keywords: ["PetaniKita", "petani", "UMKM kuliner", "rantai pasok pangan", "hasil panen", "agritech", "pertanian lokal", "bahan baku segar", "harga adil", "transaksi panen", "platform pertanian", "petani lokal", "UMKM kuliner lokal", "pengiriman hasil panen", "teknologi pertanian", "pertanian berkelanjutan", "ekonomi lokal", "prediksi kebutuhan AI"],
  openGraph: {
    title: "PetaniKita — Platform Rantai Pasok Pangan Hiperlokal",
    description:
      "Menghubungkan Petani dan UMKM Kuliner secara langsung untuk harga adil dan bahan baku segar.",
    siteName: "PetaniKita",
    locale: "id_ID",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-white text-slate-900 antialiased">
        <TopProgressBar />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
