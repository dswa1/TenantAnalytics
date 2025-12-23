import { useState } from 'react';
import { apiService } from '../../services/api';
import { AZURE_PERMISSIONS } from '../../utils/constants';

export default function AzureSetup({ tenant, onComplete }) {
  const [config, setConfig] = useState({
    client_id: '',
    tenant_id_azure: '',
    client_secret: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setConfig({
      ...config,
      [e.target.name]: e.target.value
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Send credentials directly to backend (one-time only)
      // Backend encrypts and stores them securely
      await apiService.setupAzure(tenant.id, config);

      // SECURITY: Clear credentials from memory immediately
      setConfig({ client_id: '', tenant_id_azure: '', client_secret: '' });

      onComplete();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Azure App Configuration</h2>
        <p className="text-gray-600 mt-2">
          Create an Azure AD app registration to connect to Microsoft Graph
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger bg-opacity-10 border border-danger rounded text-danger">
          {error}
        </div>
      )}

      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Setup Instructions</h3>

        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-medium mb-2">Step 1: Register an App</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Azure Portal</a></li>
              <li>Navigate to Azure Active Directory → App registrations</li>
              <li>Click "New registration"</li>
              <li>Name: "M365 Tenant Manager"</li>
              <li>Supported account types: "Single tenant"</li>
              <li>Redirect URI: Web - <code className="bg-gray-100 px-2 py-1 rounded text-xs">{process.env.REACT_APP_API_URL}/api/azure/consent-callback</code></li>
              <li>Click "Register"</li>
            </ol>
          </div>

          <div>
            <p className="font-medium mb-2">Step 2: Create Client Secret</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>In your app → Certificates & secrets</li>
              <li>Click "New client secret"</li>
              <li>Description: "Main secret"</li>
              <li>Expires: 24 months (or as required)</li>
              <li>Click "Add" and <strong>copy the Value immediately</strong></li>
            </ol>
          </div>

          <div>
            <p className="font-medium mb-2">Step 3: Configure API Permissions</p>
            <p className="mb-2">Add these Microsoft Graph Application permissions:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              {AZURE_PERMISSIONS.map(perm => (
                <li key={perm}><code className="bg-gray-100 px-2 py-1 rounded text-xs">{perm}</code></li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Azure Tenant ID
          </label>
          <input
            type="text"
            name="tenant_id_azure"
            value={config.tenant_id_azure}
            onChange={handleChange}
            className="input"
            placeholder="12345678-1234-1234-1234-123456789abc"
            required
            autoComplete="off"
          />
          <p className="text-sm text-gray-500 mt-1">
            Same as the tenant ID you entered in the previous step
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application (Client) ID
          </label>
          <input
            type="text"
            name="client_id"
            value={config.client_id}
            onChange={handleChange}
            className="input"
            placeholder="12345678-1234-1234-1234-123456789abc"
            required
            autoComplete="off"
          />
          <p className="text-sm text-gray-500 mt-1">
            Found in your app's Overview page
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Secret
          </label>
          <input
            type="password"
            name="client_secret"
            value={config.client_secret}
            onChange={handleChange}
            className="input"
            placeholder="••••••••••••••••••••"
            required
            autoComplete="new-password"
          />
          <p className="text-sm text-gray-500 mt-1">
            The secret value from Certificates & secrets
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>🔒 Security Note:</strong> Your credentials are encrypted with AES-256-GCM before storage.
            They are never stored in your browser and are only transmitted once over HTTPS.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Saving Securely...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
