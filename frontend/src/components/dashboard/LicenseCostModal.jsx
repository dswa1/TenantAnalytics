import { useState } from 'react';

export default function LicenseCostModal({ license, onSave, onClose }) {
  const [costPerUnit, setCostPerUnit] = useState(license?.cost_per_unit || '');
  const [currency, setCurrency] = useState(license?.currency || 'USD');
  const [notes, setNotes] = useState(license?.cost_notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Currency icon mapping
  const getCurrencyIcon = (currency) => {
    const icons = {
      'USD': '💵',
      'EUR': '💶',
      'GBP': '💷',
      'JPY': '💴',
      'CAD': '💵',
      'AUD': '💵',
      'CHF': '💵',
      'CNY': '💴',
      'INR': '💵'
    };
    return icons[currency] || '💰';
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onSave({
        cost_per_unit: costPerUnit ? parseFloat(costPerUnit) : null,
        currency,
        cost_notes: notes
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cost');
      setSaving(false);
    }
  }

  const estimatedTotal = costPerUnit && license?.consumed_units
    ? (parseFloat(costPerUnit) * license.consumed_units).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Set License Cost
          </h3>

          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="text-sm font-medium text-gray-900">{license?.sku_part_number}</div>
            <div className="text-xs text-gray-600 mt-1">
              {license?.consumed_units || 0} licenses in use
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost per License (per month)
                </label>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input w-24"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="CAD">CAD</option>
                    <option value="AUD">AUD</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(e.target.value)}
                    placeholder="0.00"
                    className="input flex-1"
                    required
                  />
                </div>
              </div>

              {estimatedTotal && (
                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-blue-900">
                        Estimated monthly cost
                      </div>
                      <div className="text-xs text-blue-700 mt-1">
                        Based on {license.consumed_units} licenses in use
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCurrencyIcon(currency)}</span>
                        <span className="text-xl font-bold text-blue-900">
                          {currency} {estimatedTotal}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this license cost..."
                  rows="3"
                  className="input w-full resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? 'Saving...' : 'Save Cost'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
