/**
 * src/components/forms/AddFoodForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-section form: food item details + safety checklist.
 * POSTs to POST /food/add (single atomic transaction on the backend).
 *
 * Props:
 *   onSuccess {function} — called with the new food item after successful POST
 *   onCancel  {function} — called when user clicks Cancel
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from 'react';
import { useApiMutation } from '../../hooks/useApi';

const FOOD_TYPES = ['cooked', 'raw', 'packaged', 'beverage', 'other'];

const CHECKLIST_ITEMS = [
  { key: 'is_freshly_cooked',  label: 'Food is freshly cooked / recently prepared',  icon: '🍳' },
  { key: 'proper_packaging',   label: 'Properly packaged in a clean, sealed container', icon: '📦' },
  { key: 'hygiene_maintained', label: 'Hygiene maintained during preparation',          icon: '🧼' },
  { key: 'allergen_declared',  label: 'Allergens declared (nuts, dairy, gluten, etc.)', icon: '⚠️' },
];

const INITIAL_FORM = {
  food_name:    '',
  description:  '',
  quantity:     '',
  food_type:    'cooked',
  expiry_time:  '',
};

const INITIAL_CHECKLIST = {
  is_freshly_cooked:  false,
  proper_packaging:   false,
  hygiene_maintained: false,
  allergen_declared:  false,
};

export default function AddFoodForm({ onSuccess, onCancel }) {
  const [form,      setForm]      = useState(INITIAL_FORM);
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [formError, setFormError] = useState('');

  const { mutate, loading, error: apiError } = useApiMutation();

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleChecklistToggle = (key) => {
    setChecklist((c) => ({ ...c, [key]: !c[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Client-side guard — all checklist items must be acknowledged
    const unchecked = CHECKLIST_ITEMS.filter((i) => !checklist[i.key]).map((i) => i.label);
    if (unchecked.length) {
      setFormError(`Please confirm all safety items before listing:\n• ${unchecked.join('\n• ')}`);
      return;
    }

    if (!form.food_name.trim()) { setFormError('Food name is required.'); return; }
    if (!form.quantity || Number(form.quantity) < 1) { setFormError('Quantity must be at least 1.'); return; }

    try {
      const payload = {
        ...form,
        quantity:   Number(form.quantity),
        expiry_time: form.expiry_time || null,
        ...checklist,
      };
      const result = await mutate('post', '/food/add', payload);
      onSuccess(result.data);
    } catch {
      // apiError state is set by the hook
    }
  };

  const displayError = formError || apiError;

  return (
    <form id="add-food-form" onSubmit={handleSubmit} noValidate className="space-y-6">

      {displayError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 whitespace-pre-line">
          {displayError}
        </div>
      )}

      {/* ── Section 1: Food Details ──────────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Food Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Name */}
          <div className="form-group sm:col-span-2">
            <label htmlFor="food_name" className="label">Food Name <span className="text-red-500">*</span></label>
            <input
              id="food_name" name="food_name" type="text" required
              className="input" placeholder="e.g. Chicken Biryani"
              value={form.food_name} onChange={handleFormChange}
            />
          </div>

          {/* Description */}
          <div className="form-group sm:col-span-2">
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description" name="description" rows={2}
              className="input resize-none" placeholder="Serves 4, contains rice and chicken…"
              value={form.description} onChange={handleFormChange}
            />
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label htmlFor="quantity" className="label">Quantity (servings / units) <span className="text-red-500">*</span></label>
            <input
              id="quantity" name="quantity" type="number" min={1} required
              className="input" placeholder="e.g. 4"
              value={form.quantity} onChange={handleFormChange}
            />
          </div>

          {/* Food Type */}
          <div className="form-group">
            <label htmlFor="food_type" className="label">Food Type</label>
            <select id="food_type" name="food_type" className="input" value={form.food_type} onChange={handleFormChange}>
              {FOOD_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Expiry */}
          <div className="form-group sm:col-span-2">
            <label htmlFor="expiry_time" className="label">Best Before / Expiry Time</label>
            <input
              id="expiry_time" name="expiry_time" type="datetime-local"
              className="input"
              min={new Date().toISOString().slice(0, 16)}
              value={form.expiry_time} onChange={handleFormChange}
            />
          </div>
        </div>
      </section>

      {/* ── Section 2: Safety Checklist ──────────────────────────────── */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
          Food Safety Checklist
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          You must confirm all items. This is recorded permanently with your listing.
        </p>
        <div className="space-y-2.5">
          {CHECKLIST_ITEMS.map(({ key, label, icon }) => (
            <label
              key={key}
              className={[
                'flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors',
                checklist[key]
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300',
              ].join(' ')}
            >
              <input
                type="checkbox"
                id={`checklist-${key}`}
                name={key}
                checked={checklist[key]}
                onChange={() => handleChecklistToggle(key)}
                className="mt-0.5 w-4 h-4 rounded accent-brand-700 flex-shrink-0 cursor-pointer"
              />
              <div>
                <span className="mr-1.5">{icon}</span>
                <span className="text-sm text-gray-700">{label}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Progress indicator ───────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${(Object.values(checklist).filter(Boolean).length / 4) * 100}%` }}
          />
        </div>
        <span>{Object.values(checklist).filter(Boolean).length}/4 items confirmed</span>
      </div>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          type="submit"
          id="add-food-submit-btn"
          disabled={loading}
          className="btn-primary flex-1"
        >
          {loading ? 'Posting…' : 'Post Food Listing'}
        </button>
      </div>
    </form>
  );
}
