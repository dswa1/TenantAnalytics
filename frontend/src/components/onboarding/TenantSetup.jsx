import { useState } from 'react';
import { useTenant } from '../../contexts/TenantContext';

export default function TenantSetup({ onComplete }) {
  const { createTenant } = useTenant();
  const [formData, setFormData] = useState({
    tenant_id: '',
    tenant_name: '',
    domain: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await createTenant(formData);
      if (error) throw new Error(error);
      onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Set Up Your Tenant</h2>
        <p className="text-gray-600 mt-2">
          Enter your Microsoft 365 tenant information to get started
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger bg-opacity-10 border border-danger rounded text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Microsoft Tenant ID
          </label>
          <input
            type="text"
            name="tenant_id"
            value={formData.tenant_id}
            onChange={handleChange}
            className="input"
            placeholder="12345678-1234-1234-1234-123456789abc"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Find this in Azure Portal → Azure Active Directory → Properties
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tenant Name
          </label>
          <input
            type="text"
            name="tenant_name"
            value={formData.tenant_name}
            onChange={handleChange}
            className="input"
            placeholder="Your Company Name"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Domain
          </label>
          <input
            type="text"
            name="domain"
            value={formData.domain}
            onChange={handleChange}
            className="input"
            placeholder="yourcompany.com"
            required
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Creating Tenant...' : 'Continue'}
          </button>
        </div>
      </form>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Need help finding your Tenant ID?</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline">portal.azure.com</a></li>
          <li>Navigate to Azure Active Directory</li>
          <li>Click on "Properties" in the left menu</li>
          <li>Copy the "Tenant ID" value</li>
        </ol>
      </div>
    </div>
  );
}
