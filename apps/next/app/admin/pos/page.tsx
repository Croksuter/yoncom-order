export default function AdminPosPage() {
  return (
    <main className="grid">
      <section className="panel stack">
        <span className="pill">/admin/pos</span>
        <h1>POS</h1>
        <p className="muted">
          This route will absorb the current admin table, inventory, and order
          modal flows.
        </p>
      </section>
      <section className="panel stack">
        <h2>Protected flows</h2>
        <ul className="status-list">
          <li>
            <span className="label">Tables</span>
            <span>Create, update, occupy, vacate, remove</span>
          </li>
          <li>
            <span className="label">Orders</span>
            <span>Inspect, cancel, deposit, complete</span>
          </li>
          <li>
            <span className="label">Inventory</span>
            <span>Menu categories, menu items, image upload</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
