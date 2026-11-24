import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown, ArrowUpRight, CalendarDays, FileHeart, HeartHandshake, Building2, MapPin, Receipt, Video,
} from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import SelectType from "@/components/form/selectType";
import EnterDetails from "@/components/form/EnterDetails";

const homeDescription = "Discover trusted schemes, manage medical records, and find the right care faster — all in one place.";

const CreateDid = dynamic(() => import("@/components/form/createDid"), {
  ssr: false,
  loading: () => <p role="status">Loading record setup…</p>,
});

const serviceGroups = [
  {
    title: "Find care and support",
    services: [
      [HeartHandshake, "/schemes", "nav.schemes", "Explore government schemes and check eligibility"],
      [MapPin, "/route", "nav.route", "Plan an accessible route to a hospital"],
      [Building2, "/beds", "nav.beds", "Check bed listings and accessibility details"],
      [Video, "/consult", "nav.consult", "Find a doctor and explore video consultations"],
    ],
  },
  {
    title: "More ways to manage care",
    services: [
      [FileHeart, "/records", "nav.myReports", "Keep medical reports ready to share"],
      [Receipt, "/billing", "nav.billing", "Review treatment bills and receipts"],
      [CalendarDays, "/appointments", "nav.appointments", "View and manage appointments"],
    ],
  },
];

export default function Home() {
  const { t } = useI18n();
  const [type, setType] = useState("");
  const [details, setDetails] = useState({ name: "", year: "" });
  const [step, setStep] = useState(0);
  const setupHeading = useRef(null);

  const scrollInstance = useRef(null);

  useEffect(() => () => scrollInstance.current?.destroy(), []);

  async function jumpToSection(event) {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hash = event.currentTarget.hash;
    const target = document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    try {
      const { default: Lenis } = await import("lenis");
      if (!target.isConnected) return;
      scrollInstance.current?.destroy();
      const lenis = new Lenis({ autoRaf: true, smoothWheel: false });
      scrollInstance.current = lenis;
      history.pushState(history.state, "", hash);
      target.focus({ preventScroll: true });
      lenis.scrollTo(target, {
        offset: -(document.querySelector(".site-header")?.offsetHeight || 0),
        duration: 0.65,
        onComplete: () => lenis.destroy(),
      });
    } catch {
      location.hash = hash;
    }
  }

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
    <>
      <Head>
        <title>Swasth Saathi | Find and manage care</title>
        <meta name="description" content={homeDescription} />
        <meta property="og:title" content="Swasth Saathi | Find and manage care" />
        <meta property="og:description" content={homeDescription} />
        <meta property="og:type" content="website" />
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
      </Head>

      <section className="home-hero hero" aria-labelledby="home-title" data-enter>
        <div className="site-container wrap home-hero-grid">
          <div className="home-intro">
            <h1 id="home-title">Care, clarity, and support for every <span className="journey-mark">health journey.</span></h1>
            <p className="home-lede">{homeDescription}</p>
            <div className="home-actions">
              <a className="site-button site-button-primary" href="#care-services" onClick={jumpToSection}>Explore care services <ArrowDown size={16} aria-hidden="true" /></a>
              <a className="site-button site-button-secondary" href="#record-setup" onClick={jumpToSection}>Set up records</a>
            </div>
          </div>
          <picture className="home-photo" data-visual>
            <source media="(max-width: 47.99rem)" srcSet="/images/care-reception-small.webp" />
            <img src="/images/care-reception.webp" width="1536" height="1024" fetchpriority="high"
              alt="Two women look at a phone together in a clinic waiting area" />
          </picture>
          <nav className="hero-shortcuts" aria-label="Care shortcuts">
            {serviceGroups[0].services.filter(([, href]) => href !== "/route").map(([Icon, href, label]) => (
              <Link key={href} href={href} prefetch={false}>
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                {t(label)}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="home-services" id="care-services" aria-labelledby="care-services-title" tabIndex={-1}>
        <div className="site-container wrap home-directory">
          <div className="home-directory-intro">
            <h2 id="care-services-title" className="home-section-title">Healthcare services</h2>
            <p>Find support for a hospital visit or manage records, bills, and appointments.</p>
          </div>
          <div className="home-service-groups">
            {serviceGroups.map(({ title, services }) => (
              <section key={title} className="home-service-group">
                <h3>{title}</h3>
                <ul className="home-service-list">
                  {services.map(([Icon, href, label, description]) => (
                    <li key={href}>
                      <Link prefetch={false} className="home-service-link" href={href}>
                        <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
                        <span><strong>{t(label)}</strong><small>{description}</small></span>
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="home-setup" aria-labelledby="record-setup">
        <div className="site-container wrap home-setup-grid">
          <div>
            <h2 id="record-setup" ref={setupHeading} tabIndex={-1} className="home-section-title">Set up your record workspace</h2>
            <p>Create a record identity as an individual or as an organization that issues health records.</p>
            <Link href="/dashboard" className="home-text-link">Open the record dashboard</Link>
          </div>
          <div className="home-setup-panel">
            {step === 0 && <SelectType onSelect={selectRole} />}
            {step === 1 && <EnterDetails type={type} details={details} setDetails={setDetails} setStep={changeStep} />}
            {step === 2 && <CreateDid {...details} userType={type} onBack={() => changeStep(1)} />}
          </div>
        </div>
      </section>
    </>
  );
}
