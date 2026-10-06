export default async function Installed({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ok, error, type } = await searchParams;
  return (
    <div className="landing">
      <img className="logo-mark big" src="/logo.svg" alt="PageForge" />
      {ok ? (
        <>
          <h1>PageForge is installed 🎉</h1>
          <p className="muted">
            {type === "Company"
              ? "Installed for your agency. Each selected sub-account now has PageForge in its left menu."
              : "Open your sub-account and click PageForge in the left menu to start building."}
          </p>
        </>
      ) : (
        <>
          <h1>Installation failed</h1>
          <p className="error">{error || "Unknown error"}</p>
          <p className="muted">Please try installing again from the HighLevel Marketplace.</p>
        </>
      )}
    </div>
  );
}
