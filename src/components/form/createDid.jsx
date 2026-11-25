import { Button } from "@/components/ui/button";
import { useRouter } from "next/router";
import { useState } from "react";
import { useSetRecoilState } from "recoil";
import { didState, web5State } from "@/atoms/data";
import protocolDefinition from "@/lib/protocolDefinition.json";
import { initWeb5 } from "@/helpers/initWeb5";

export default function CreateDid({ name, year, userType, onBack }) {
  const router = useRouter();
  const setDidData = useSetRecoilState(didState);
  const setWeb5 = useSetRecoilState(web5State);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateDidAndConfigure() {
    try {
      const { web5, did } = await initWeb5();
      const { protocol } = await web5.dwn.protocols.configure({
        message: { definition: protocolDefinition },
      });
      await protocol.send(did);
      setWeb5(web5);
      return did;
    } catch (error) {
      console.warn("Web5/DWN is unavailable. Using a local demo identity.", error);
      setWeb5(null);
      return `did:swasth:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError("");
    const did = await generateDidAndConfigure();
    setDidData({ did, name, year, userType });
    try {
      await router.push("/dashboard");
    } catch {
      setError("Could not open the record dashboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h3 className="text-lg font-semibold">Create a record identity</h3>
      <p className="text-sm text-slate-700">Create a digital identifier for {name} to open the record dashboard.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading} onClick={handleClick}>Create identity</Button>
        <Button type="button" variant="outline" disabled={loading} onClick={onBack}>Back</Button>
      </div>
      {loading && <p role="status" className="text-sm">Creating your record identity…</p>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </div>
  );
}
