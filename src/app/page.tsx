import Link from "next/link";

export default function Home() {
  return (
    <div className="landing">
      <div className="logo-mark big">P</div>
      <h1>Page Builder Pro for HighLevel</h1>
      <p className="muted">
        Elementor-style visual builder with tabs, sliders, countdowns, before/after, pricing tables, popups, scroll
        animations and CRM-connected lead forms. Publish into any HighLevel funnel or website.
      </p>
      <p>
        Install the app from the HighLevel Marketplace, then open <b>Page Builder Pro</b> from your sub-account&apos;s
        left menu.
      </p>
      <Link className="btn btn-primary" href="/app">
        Open builder
      </Link>
    </div>
  );
}
