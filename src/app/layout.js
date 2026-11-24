import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import SharedShell from "../components/SharedShell";
import { I18nProvider } from "../components/I18nProvider";
import { normalizeLanguage } from "../lib/i18n";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "Swasth Saathi - Accessible Healthcare & Care Wallet",
  description: "Patient Health Hub, ABDM / ABHA verification, Care Wallet with Razorpay settlement, hospital bed tracking, government schemes, accessible routes, teleconsultation, and SOS alerts.",
};

export default function RootLayout({ children }) {
  const cookieLang = cookies().get("swasth_lang")?.value || "en";
  const initialLanguage = normalizeLanguage(cookieLang);

  return (
    <html lang={initialLanguage} className={`${sansFont.variable} ${monoFont.variable}`}>
      <body className="swasth-canvas font-sans text-slate-900 antialiased">
        <I18nProvider initialLanguage={initialLanguage}>
          <SharedShell>{children}</SharedShell>
        </I18nProvider>
      </body>
    </html>
  );
}
