import Head from "next/head";
import Link from "next/link";
import { motion, MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import {
  ArrowDown, ArrowUpRight, CalendarDays, FileHeart, HeartHandshake, Building2, MapPin, Receipt, Video,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import BlurText from "@/components/BlurText";
import SelectType from "@/components/form/selectType";
import EnterDetails from "@/components/form/EnterDetails";

const homeDescription = "Discover trusted schemes, manage medical records, and find the right care faster — all in one place.";

const CreateDid = dynamic(() => import("@/components/form/createDid"), {
  ssr: false,
  loading: () => <p role="status">Loading record setup…</p>,
});

const ServiceLink = motion.create(Link);
const serviceSpring = { type: "spring", stiffness: 420, damping: 32 };

const serviceGroups = [
  {
    title: "Find care and support",
    services: [
      [HeartHandshake, "/schemes", "nav.schemes", "home.schemes"],
      [MapPin, "/route", "nav.route", "home.route"],
      [Building2, "/beds", "nav.beds", "home.beds"],
      [Video, "/consult", "nav.consult", "home.consult"],
    ],
  },
  {
    title: "More ways to manage care",
    services: [
      [FileHeart, "/records", "nav.myReports", "home.reports"],
      [Receipt, "/billing", "nav.billing", "home.billing"],
      [CalendarDays, "/appointments", "nav.appointments", "home.appointments"],
    ],
  },
];

export default function Home() {
  const { t, language, formatCurrency } = useI18n();
  const [type, setType] = useState("");
  const [details, setDetails] = useState({ name: "", year: "" });
  const [step, setStep] = useState(0);
  const setupHeading = useRef(null);

  function changeStep(nextStep) {
    setStep(nextStep);
    setupHeading.current?.focus({ preventScroll: true });
  }

  function selectRole(nextRole) {
    if (nextRole !== type) setDetails({ name: "", year: "" });
    setType(nextRole);
    changeStep(1);
  }

  return (
    <MotionConfig reducedMotion="user">
      <Head>
        <title>Swasth Saathi | Find and manage care</title>
        <meta name="description" content={homeDescription} />
        <meta property="og:title" content="Swasth Saathi | Find and manage care" />
        <meta property="og:description" content={homeDescription} />
        <meta property="og:type" content="website" />
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
      </Head>

      <section className="care-front" aria-labelledby="home-title">
        <div className="site-container care-front-grid">
          <picture className="care-front-portrait" aria-hidden="true">
            <source media="(min-width: 75rem)" srcSet="/images/care-reception.webp" />
            <img src="/images/care-reception-small.webp" alt="" width="768" height="512" fetchpriority="high" />
          </picture>
          <div className="care-front-copy">
            <h1 id="home-title"><span>{t("home.find")}</span><em><BlurText key={language} text={t("home.visit")} trigger="load" delay={55} blur={4} distance={10} /></em></h1>
            <p>{t("home.intro")}</p>
            <Link href="/records" className="care-record-link">{t("home.open")} <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
          <nav className="care-finder" aria-labelledby="care-finder-title">
            <h2 id="care-finder-title">{t("home.finder")}</h2>
            {serviceGroups[0].services.map(([Icon, href, label, description]) => (
              <ServiceLink key={href} href={href} prefetch={false}
                whileHover={{ y: -3 }} whileFocus={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={serviceSpring}>
                <span className="finder-icon"><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></span>
                <span><strong>{t(label)}</strong><small>{t(description)}</small></span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </ServiceLink>
            ))}
          </nav>
        </div>
      </section>
      <section className="care-workspace site-container" id="care-services" aria-labelledby="workspace-title">
        <div className="care-workspace-heading">
          <h2 id="workspace-title">{t("home.manage")}</h2>
          <a href="#record-setup" className="home-text-link">{t("home.setup")} <ArrowDown size={15} aria-hidden="true" /></a>
        </div>
        <div className="care-tools">
          {serviceGroups[1].services.map(([Icon, href, label, description]) => (
            <ServiceLink key={href} href={href} prefetch={false}
                whileHover={{ y: -3 }} whileFocus={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={serviceSpring}>
              <Icon aria-hidden="true" size={26} strokeWidth={1.5} />
              <strong>{t(label)}</strong><small>{t(description)}</small>
              <ArrowUpRight aria-hidden="true" size={18} />
            </ServiceLink>
          ))}
        </div>
      </section>

      <section className="home-setup" aria-labelledby="record-setup">
        <div className="site-container wrap home-setup-grid">
          <div>
            <h2 id="record-setup" ref={setupHeading} tabIndex={-1} className="home-section-title">Set up your record workspace</h2>
            <p>Create a record identity as an individual or as an organization that issues health records.</p>
            <figure className="wallet-stage">
              <figcaption>{t("home.sample")}</figcaption>
              <div className="wallet-stage-window">
                <div className="wallet-stage-title"><Receipt size={20} aria-hidden="true" />{t("nav.billing")}</div>
                <div className="wallet-stage-row"><span>{t("wallet.status.paid")}</span><strong>{formatCurrency(850)}</strong></div>
                <div className="wallet-stage-row"><span>{t("wallet.status.pending")}</span><strong>{formatCurrency(250)}</strong></div>
              </div>
            </figure>
            <Link href="/dashboard" className="home-text-link">Open the record dashboard</Link>
          </div>
          <div className="home-setup-panel">
            {step === 0 && <SelectType onSelect={selectRole} />}
            {step === 1 && <EnterDetails type={type} details={details} setDetails={setDetails} setStep={changeStep} />}
            {step === 2 && <CreateDid {...details} userType={type} onBack={() => changeStep(1)} />}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
