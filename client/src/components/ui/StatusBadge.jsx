/**
 * src/components/ui/StatusBadge.jsx
 * Maps API status strings → Tailwind badge classes defined in index.css
 */
const MAP = {
  available: 'badge-available',
  reserved:  'badge-reserved',
  donated:   'badge-donated',
  expired:   'badge-expired',
  pending:   'badge-pending',
  accepted:  'badge-accepted',
  rejected:  'badge-expired',
  completed: 'badge-completed',
  delivered: 'badge-delivered',
  picked_up: 'badge-reserved',
  assigned:  'badge-pending',
  failed:    'badge-expired',
};

const LABELS = {
  picked_up: 'Picked Up',
};

export default function StatusBadge({ status }) {
  const cls   = MAP[status] ?? 'badge bg-gray-100 text-gray-600';
  const label = LABELS[status] ?? status?.replace(/_/g, ' ');
  return <span className={cls}>{label}</span>;
}
