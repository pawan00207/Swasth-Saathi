import Head from "next/head";
import Link from "next/link";
import { useRecoilValue } from "recoil";
import { imageState } from "@/atoms/data";

export default function ViewHealthRecord() {
  const image = useRecoilValue(imageState);

  return (
    <div className="site-container py-8 sm:py-12">
      <Head><title>Health record | Swasth Saathi</title></Head>
      <Link href="/dashboard" className="site-text-button">Back to record dashboard</Link>
      <h1 className="mt-2">Health record</h1>
      <div className="site-panel mt-6">
        {image ? <img className="mx-auto max-h-[75vh] max-w-full object-contain" src={image} alt="Health record" /> :
          <p className="text-slate-700">Open a record from the dashboard to view it here.</p>}
      </div>
    </div>
  );
}
