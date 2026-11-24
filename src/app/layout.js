import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import { cookies } from "next/headers";
import SharedShell from "../components/SharedShell";
import { I18nProvider } from "../components/I18nProvider";
import { normalizeLanguage } from "../lib/i18n";

export const metadata = {
  title: "Swasth Saathi - Accessible Healthcare",
  description: "Schemes, Care Wallet, accessible routes, teleconsultation, bed availability, SOS alerts, and medical records.",
};

export default function RootLayout({ children }) {
  const cookieLang = cookies().get("swasth_lang")?.value || "en";
  const initialLanguage = normalizeLanguage(cookieLang);

  return (
    <html lang={initialLanguage}>
      <body>
        <I18nProvider initialLanguage={initialLanguage}>
          <SharedShell>{children}</SharedShell>
        </I18nProvider>
      </body>
    </html>
  );
}
