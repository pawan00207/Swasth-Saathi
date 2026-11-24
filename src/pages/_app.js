import "@/styles/globals.css";
import { RecoilRoot } from "recoil";
import dynamic from "next/dynamic";
import { I18nProvider } from "@/components/I18nProvider";
import SosFloatingWidget from "@/features/sos/SosFloatingWidget";

const App = ({ Component, pageProps }) => {
  return (
    <I18nProvider>
      <RecoilRoot>
        <Component {...pageProps} />
        <SosFloatingWidget />
      </RecoilRoot>
    </I18nProvider>
  );
};

export default dynamic(() => Promise.resolve(App), {
  ssr: false,
});
