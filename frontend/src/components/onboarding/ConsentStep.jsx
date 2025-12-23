import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

export default function ConsentStep({ tenant, onComplete }) {
  const [consentUrl, setConsentUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadConsentUrl();
  }, [tenant]);

  async function loadConsentUrl() {
    try {
      const { data } = await apiService.getConsentUrl(tenant.id);
      setConsentUrl(data.consent_url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate consent URL');
    } finally {
      setLoading(false);
    }
  }

  async function checkConsentStatus() {
    setChecking(true);
    try {
      const { data } = await apiService.checkAzureStatus(tenant.id);
      if (data.status?.admin_consent_granted) {
        onComplete();
      } else {
        setError('Admin consent not detected yet. Please complete the consent flow and try again.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to check consent status');
    } finally {
      setChecking(false);
    }
  }

  function openConsentUrl() {
    if (consentUrl) {
      window.open(consentUrl, '_blank', 'width=600,height=800');
      // Auto-check status after 5 seconds
      setTimeout(() => {
        checkConsentStatus();
      }, 5000);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Preparing admin consent..." />;
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Grant Admin Consent</h2>
        <p className="text-gray-600 mt-2">
          Final step: Grant admin consent to allow access to Microsoft Graph
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger bg-opacity-10 border border-danger rounded text-danger">
          {error}
        </div>
      )}

      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">What is Admin Consent?</h3>
        <p className="text-gray-700 mb-4">
          Admin consent allows this application to access your Microsoft 365 tenant data on behalf
          of your organization. This is a one-time process that requires Global Administrator permissions.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <p className="font-medium text-blue-900 mb-2">Permissions Requested:</p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Read all users' full profiles</li>
            <li>Read directory data</li>
            <li>Read mailbox settings</li>
            <li>Read security events</li>
            <li>Read audit logs</li>
          </ul>
          <p className="text-xs text-blue-700 mt-3">
            These are read-only permissions. This app cannot modify your data.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Grant Consent Steps:</h3>

        <ol className="space-y-4 mb-6">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              1
            </span>
            <div>
              <p className="font-medium">Click the button below to open the Microsoft consent page</p>
              <p className="text-sm text-gray-600">A new window will open</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              2
            </span>
            <div>
              <p className="font-medium">Sign in with a Global Administrator account</p>
              <p className="text-sm text-gray-600">You must be a Global Admin to grant consent</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              3
            </span>
            <div>
              <p className="font-medium">Review permissions and click "Accept"</p>
              <p className="text-sm text-gray-600">Carefully review what the app can access</p>
            </div>
          </li>

          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">
              4
            </span>
            <div>
              <p className="font-medium">Return here and verify consent</p>
              <p className="text-sm text-gray-600">We'll automatically check if consent was granted</p>
            </div>
          </li>
        </ol>

        <div className="flex gap-3">
          <button
            onClick={openConsentUrl}
            disabled={!consentUrl}
            className="btn-primary flex-1"
          >
            Open Consent Page
          </button>
          <button
            onClick={checkConsentStatus}
            disabled={checking}
            className="btn-secondary"
          >
            {checking ? 'Checking...' : 'Verify Consent'}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-700">
          <strong>Troubleshooting:</strong> If the consent page doesn't open, you can{' '}
          <a
            href={consentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            click here
          </a>{' '}
          to open it manually.
        </p>
      </div>
    </div>
  );
}
