import Link from "next/link";

export default function Home() {
  return (
    <div className="landing">
      <img className="logo-mark big" src="/logo.svg" alt="PageForge" />
      <h1>PageForge for HighLevel</h1>
      <p className="muted">
        Drag-and-drop widget builder with tabs, sliders, countdowns, before/after, pricing tables, popups, scroll
        animations and CRM-connected lead forms. Publish into any HighLevel funnel or website.
      </p>
      <p>
        Install the app from the HighLevel Marketplace, then open <b>PageForge</b> from your sub-account&apos;s
        left menu.
      </p>
      <Link className="btn btn-primary" href="/app">
        Open builder
      </Link>
    </div>
  );
}
