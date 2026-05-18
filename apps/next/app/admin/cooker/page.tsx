export default function AdminCookerPage() {
  return (
    <main className="grid">
      <section className="panel stack">
        <span className="pill">/admin/cooker</span>
        <h1>Cooker</h1>
        <p className="muted">
          This route will preserve kitchen order monitoring and menu order
          status updates.
        </p>
      </section>
      <section className="panel stack">
        <h2>Status contract</h2>
        <ul className="status-list">
          <li>
            <span className="label">Source</span>
            <span>menuOrders.status</span>
          </li>
          <li>
            <span className="label">Endpoint</span>
            <span>PUT /api/admin/order/complete</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
