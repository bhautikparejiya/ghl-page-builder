export const metadata = { title: "Privacy Policy · Page Builder Pro" };

// TEMPLATE: review with a legal professional and replace the bracketed placeholders before publishing.
export default function Privacy() {
  return (
    <div className="landing" style={{ textAlign: "left" }}>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: [DATE]</p>
      <p>
        Page Builder Pro (&quot;we&quot;, &quot;us&quot;) is operated by [YOUR COMPANY]. This policy explains what we
        process when you install our HighLevel Marketplace app.
      </p>
      <h3>Data we process</h3>
      <ul>
        <li>OAuth tokens issued by HighLevel for the sub-accounts that install the app.</li>
        <li>Pages you build: content, styles and settings.</li>
        <li>
          Form submissions from your published pages, which we forward to your HighLevel CRM. We keep a copy of the
          last 200 submissions per page so you can review them in the app.
        </li>
        <li>Basic user context provided by HighLevel (user id, name, email, sub-account id) to authenticate you.</li>
      </ul>
      <h3>How we use it</h3>
      <p>Only to provide the service. We do not sell data or use it for advertising.</p>
      <h3>Retention and deletion</h3>
      <p>
        Uninstalling the app revokes and deletes the stored tokens. Contact [SUPPORT EMAIL] to delete your pages and
        submissions.
      </p>
      <h3>Contact</h3>
      <p>[SUPPORT EMAIL]</p>
    </div>
  );
}
