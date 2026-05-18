export default function AuthPage() {
  return (
    <main className="grid">
      <section className="panel stack">
        <span className="pill">/auth</span>
        <h1>Auth</h1>
        <p className="muted">
          The first parity target is sign-up, sign-in, session preservation,
          and sign-out with Lucia-compatible cookies.
        </p>
      </section>
      <section className="panel stack">
        <h2>Server contract</h2>
        <ul className="status-list">
          <li>
            <span className="label">POST</span>
            <span>/api/auth/sign-up</span>
          </li>
          <li>
            <span className="label">POST</span>
            <span>/api/auth/sign-in</span>
          </li>
          <li>
            <span className="label">GET</span>
            <span>/api/auth/session</span>
          </li>
          <li>
            <span className="label">POST</span>
            <span>/api/auth/sign-out</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
