import "@/styles/globals.css";
import { RecoilRoot } from "recoil";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { I18nProvider } from "@/components/I18nProvider";
import VoiceCommandBar from "@/components/VoiceCommandBar";
import SosFloatingWidget from "@/features/sos/SosFloatingWidget";

const App = ({ Component, pageProps }) => {
  const router = useRouter();
  return (
    <I18nProvider>
      <RecoilRoot>
        <Component {...pageProps} />
        <VoiceCommandBar variant="floating" onNavigate={(url) => router.push(url)} />
        <SosFloatingWidget />
      </RecoilRoot>
    </I18nProvider>
  );
};

export default dynamic(() => Promise.resolve(App), {
  ssr: false,
});
