import Link from "next/link";
import {
  apiRouteContracts,
  migrationHotspots,
  webRouteContracts,
} from "~/lib/migration/route-contracts";
import { runtimeDecision, runtimeNotes } from "~/lib/server/runtime";

export default function HomePage() {
  return (
    <main className="stack">
      <section className="panel stack">
        <span className="pill">Migration branch: codex/nextjs-migration</span>
        <h1>Next.js migration workspace</h1>
        <p className="muted">
          This workspace preserves the current route contracts while the Remix
          and Hono implementation is migrated in slices.
        </p>
        <div className="actions">
          <Link className="button" href="/client/table/demo-table">
            Client table
          </Link>
          <Link className="button secondary" href="/admin/pos">
            Admin POS
          </Link>
          <Link className="button secondary" href="/admin/cooker">
            Cooker
          </Link>
        </div>
      </section>

      <section className="grid">
        <div className="panel stack">
          <h2>Route parity</h2>
          <ul className="status-list">
            {webRouteContracts.map((route) => (
              <li key={route.currentPath}>
                <span className="label">{route.currentPath}</span>
                <span>{route.nextTarget}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel stack">
          <h2>Runtime</h2>
          <ul className="status-list">
            <li>
              <span className="label">Decision</span>
              <span>{runtimeDecision}</span>
            </li>
            {runtimeNotes.map((note) => (
              <li key={note}>
                <span className="label">Note</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid">
        <div className="panel stack">
          <h2>API contracts</h2>
          <ul className="status-list">
            {apiRouteContracts.slice(0, 12).map((contract) => (
              <li key={contract}>
                <span className="label">Preserve</span>
                <span>{contract}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel stack">
          <h2>Hotspots</h2>
          <ul className="status-list">
            {migrationHotspots.map((hotspot) => (
              <li key={hotspot}>
                <span className="label">Protect</span>
                <span>{hotspot}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
