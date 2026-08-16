/**
 * src/components/ui/FoodCard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Card displaying a single food listing (used on ReceiverDashboard).
 *
 * Props:
 *   food         {object}    — API food object
 *   onRequest    {function}  — called when "Request Food" clicked
 *   isRequesting {boolean}   — disables button while POST is in-flight
 * ─────────────────────────────────────────────────────────────────────────────
 */

import StatusBadge from './StatusBadge';

const TYPE_EMOJI = {
  cooked:   '🍲',
  raw:      '🥦',
  packaged: '📦',
  beverage: '🥤',
  other:    '🍽️',
};

function timeLeft(expiry) {
  if (!expiry) return null;
  const diff = new Date(expiry) - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h left`;
  return `${h}h left`;
}

export default function FoodCard({ food, onRequest, isRequesting }) {
  const expiryLabel = timeLeft(food.expiry_time);
  const isUrgent    = food.expiry_time && (new Date(food.expiry_time) - Date.now()) < 6 * 3_600_000;

  return (
    <article className="card p-5 flex flex-col gap-3 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl flex-shrink-0">
            {TYPE_EMOJI[food.food_type] ?? '🍽️'}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate leading-tight">
              {food.food_name}
            </h3>
            <p className="text-xs text-gray-400 capitalize">{food.food_type}</p>
          </div>
        </div>
        <StatusBadge status={food.status} />
      </div>

      {/* Description */}
      {food.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{food.description}</p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>📦 Qty: <strong className="text-gray-700">{food.quantity}</strong></span>
        <span>📍 {food.donor_location ?? '—'}</span>
        {expiryLabel && (
          <span className={isUrgent ? 'text-red-600 font-medium' : ''}>
            ⏱ {expiryLabel}
          </span>
        )}
      </div>

      {/* Safety indicators */}
      <div className="flex flex-wrap gap-1.5">
        {food.is_freshly_cooked  && <span className="badge bg-green-50 text-green-700">✓ Fresh</span>}
        {food.proper_packaging   && <span className="badge bg-green-50 text-green-700">✓ Packaged</span>}
        {food.allergen_declared  && <span className="badge bg-amber-50 text-amber-700">⚠ Allergens listed</span>}
      </div>

      {/* Donor + CTA */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50 mt-auto">
        <p className="text-xs text-gray-400 truncate">
          by <span className="font-medium text-gray-600">{food.donor_name}</span>
        </p>
        <button
          onClick={() => onRequest(food)}
          disabled={isRequesting || food.status !== 'available'}
          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          aria-label={`Request ${food.food_name}`}
        >
          {isRequesting ? 'Requesting…' : 'Request'}
        </button>
      </div>
    </article>
  );
}
