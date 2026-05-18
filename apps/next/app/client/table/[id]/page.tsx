type ClientTablePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientTablePage({ params }: ClientTablePageProps) {
  const { id } = await params;

  return (
    <main className="grid">
      <section className="panel stack">
        <span className="pill">/client/table/{id}</span>
        <h1>Table {id}</h1>
        <p className="muted">
          This route will preserve menu loading, cart edits, order creation,
          order history, and payment guidance.
        </p>
      </section>
      <section className="panel stack">
        <h2>Order guards</h2>
        <ul className="status-list">
          <li>
            <span className="label">Active table</span>
            <span>Requires active tableContext</span>
          </li>
          <li>
            <span className="label">Duplicate</span>
            <span>Rejects active unpaid order</span>
          </li>
          <li>
            <span className="label">Stock</span>
            <span>Menu quantity decrements on order creation</span>
          </li>
        </ul>
      </section>
    </main>
  );
}
