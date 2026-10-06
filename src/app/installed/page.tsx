export default async function Installed({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { ok, error, type } = await searchParams;
  return (
    <div className="landing">
      <div className="logo-mark big">P</div>
      {ok ? (
        <>
          <h1>Page Builder Pro is installed 🎉</h1>
          <p className="muted">
            {type === "Company"
              ? "Installed for your agency. Each selected sub-account now has Page Builder Pro in its left menu."
              : "Open your sub-account and click Page Builder Pro in the left menu to start building."}
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
