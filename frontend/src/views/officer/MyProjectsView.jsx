import React from 'react';
import { formatDate } from '../../constants';

export default function MyProjectsView({ projects }) {
  return (
    <section className="pt-panel">
      <div className="pt-panel-head"><div><h2>My assigned projects</h2><p>Only projects the Director has actively assigned to you</p></div><span className="pt-count-badge">{projects.length}</span></div>
      <div className="pt-table-scroll">
        <table className="pt-data-table">
          <thead><tr><th>PROJECT</th><th>SECTOR</th><th>FUNDING</th><th>DATES</th><th>STATUS</th></tr></thead>
          <tbody>
            {!projects.length && <tr><td colSpan="5" className="pt-empty">No active project assignments. Contact your Director.</td></tr>}
            {projects.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><small>{p.code}</small></td>
                <td>{p.sectorName || '—'}</td>
                <td>{p.fundingSource || '—'}</td>
                <td className="pt-mono">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                <td><span className="pt-badge-tone pt-badge-tone-success">{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
