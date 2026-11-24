import "@/styles/globals.css";
import { RecoilRoot } from "recoil";
import dynamic from "next/dynamic";
import { I18nProvider } from "@/components/I18nProvider";
import SharedShell from "@/components/SharedShell";

function AppFrame({ Component, pageProps, isHome = false }) {
  return (
    <I18nProvider>
      <RecoilRoot>
        <SharedShell isHome={isHome}><Component {...pageProps} /></SharedShell>
      </RecoilRoot>
    </I18nProvider>
  );
}

const ClientAppFrame = dynamic(() => Promise.resolve(AppFrame), { ssr: false });

export default function App({ Component, pageProps, router }) {
  if (router.pathname === "/") {
    return <AppFrame Component={Component} pageProps={pageProps} isHome />;
  }
  return <ClientAppFrame Component={Component} pageProps={pageProps} />;
}
