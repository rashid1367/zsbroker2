/* app/layout.jsx */
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// تنظیم فونت‌ها
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // برای بهبود بارگذاری فونت
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // برای بهبود بارگذاری فونت
});

// تنظیمات متا برای SEO
export const metadata = {
  title: "11 Broker - Zero Spreads, Zero Commissions Trading Platform",
  description:
    "Trade stocks, crypto, forex, futures, and commodities with zero spreads and zero commissions on 11 Broker's professional trading platform. Join now and start trading!",
  keywords: [
    "trading platform",
    "zero spreads",
    "zero commissions",
    "online broker",
    "stock trading",
    "crypto trading",
    "forex trading",
    "futures trading",
    "commodities trading",
  ],
  openGraph: {
    title: "11 Broker - Zero Spreads, Zero Commissions Trading Platform",
    description:
      "Trade stocks, crypto, forex, futures, and commodities with zero spreads and zero commissions on 11 Broker's professional trading platform.",
    url: "https://www.11broker.com", // جایگزین با URL واقعی سایت
    siteName: "11 Broker",
    images: [
      {
        url: "https://www.11broker.com/og-image.jpg", // جایگزین با URL تصویر واقعی
        width: 1200,
        height: 630,
        alt: "11 Broker Trading Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "11 Broker - Zero Spreads, Zero Commissions Trading Platform",
    description:
      "Trade stocks, crypto, forex, futures, and commodities with zero spreads and zero commissions on 11 Broker's professional trading platform.",
    images: ["https://www.11broker.com/og-image.jpg"], // جایگزین با URL تصویر واقعی
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-grow">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}