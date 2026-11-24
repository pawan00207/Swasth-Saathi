import "../styles/globals.css";
import "leaflet/dist/leaflet.css";
import SharedShell from "../components/SharedShell";

export const metadata = {
  title: "Swasth Saathi - Accessible Healthcare",
  description: "Schemes, accessible routes, teleconsultation, bed availability, and medical records.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SharedShell>{children}</SharedShell>
      </body>
    </html>
  );
}
