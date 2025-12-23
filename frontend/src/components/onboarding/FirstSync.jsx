import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { SYNC_TYPES } from '../../utils/constants';
import LoadingSpinner from '../common/LoadingSpinner';

export default function FirstSync({ tenant, onComplete }) {
  const [selectedTypes, setSelectedTypes] = useState([
    SYNC_TYPES.USERS,
    SYNC_TYPES.LICENSES,
    SYNC_TYPES.MAILBOXES,
    SYNC_TYPES.SECURITY_EVENTS
  ]);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [error, setError] = useState(null);
  const [pollTimeoutId, setPollTimeoutId] = useState(null);
  const [pollStartTime, setPollStartTime] = useState(null);

  function toggleSyncType(type) {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  }

  async function startSync() {
    if (selectedTypes.length === 0) {
      setError('Please select at least one data type to sync');
      return;
    }

    // Clear any existing poll timeout
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      setPollTimeoutId(null);
    }

    setSyncing(true);
    setError(null);
    setPollStartTime(Date.now());

    try {
      const { data } = await apiService.startSync(tenant.id, selectedTypes);
      setSyncStatus({
        sync_id: data.sync_id,
        status: 'in_progress',
        message: 'Sync started successfully'
      });

      // Poll for sync completion
      pollSyncStatus(data.sync_id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start sync');
      setSyncing(false);
      setPollStartTime(null);
    }
  }

  async function pollSyncStatus(syncId) {
    // Maximum poll duration: 10 minutes
    const MAX_POLL_DURATION = 10 * 60 * 1000;
    const elapsed = Date.now() - pollStartTime;

    if (elapsed > MAX_POLL_DURATION) {
      console.error('Sync polling timeout - exceeded 10 minutes');
      setSyncing(false);
      setPollStartTime(null);
      setPollTimeoutId(null);
      setError('Sync is taking longer than expected. You can continue to the dashboard and check the sync status there.');
      return;
    }

    try {
      const { data } = await apiService.getSyncStatus(syncId);
      setSyncStatus(data);

      if (data.status === 'completed') {
        setSyncing(false);
        setPollStartTime(null);
        setPollTimeoutId(null);
        // Auto-complete after 2 seconds
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else if (data.status === 'failed') {
        setSyncing(false);
        setPollStartTime(null);
        setPollTimeoutId(null);
        setError(data.error_message || 'Sync failed');
      } else if (data.status === 'in_progress' || data.status === 'pending') {
        // Poll again in 4 seconds
        const timeoutId = setTimeout(() => {
          pollSyncStatus(syncId);
        }, 4000);
        setPollTimeoutId(timeoutId);
      }
    } catch (err) {
      setSyncing(false);
      setPollStartTime(null);
      setPollTimeoutId(null);
      setError('Failed to check sync status');
    }
  }

  // Cleanup: Stop polling when component unmounts
  useEffect(() => {
    return () => {
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
      }
    };
  }, [pollTimeoutId]);

  const syncOptions = [
    {
      type: SYNC_TYPES.USERS,
      label: 'Users',
      description: 'Sync user accounts, licenses, and sign-in activity',
      icon: '👥'
    },
    {
      type: SYNC_TYPES.LICENSES,
      label: 'Licenses',
      description: 'Sync license assignments and SKU details',
      icon: '📋'
    },
    {
      type: SYNC_TYPES.MAILBOXES,
      label: 'Mailboxes',
      description: 'Sync mailbox sizes, quotas, and usage',
      icon: '📧'
    },
    {
      type: SYNC_TYPES.SECURITY_EVENTS,
      label: 'Security Events',
      description: 'Sync security alerts and audit logs',
      icon: '🔒'
    }
  ];

  if (syncing && syncStatus) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="card text-center">
          <LoadingSpinner size="lg" message="" />
          <h3 className="text-xl font-bold text-gray-900 mt-4">
            {syncStatus.status === 'completed' ? 'Sync Completed!' : 'Syncing Data...'}
          </h3>
          <p className="text-gray-600 mt-2">
            {syncStatus.message || 'This may take a few minutes depending on your tenant size'}
          </p>

          {syncStatus.status === 'in_progress' && syncStatus.progress && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${syncStatus.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">{syncStatus.progress}% complete</p>
            </div>
          )}

          {syncStatus.status === 'completed' && (
            <div className="mt-6">
              <div className="text-6xl">✅</div>
              <p className="text-gray-600 mt-4">Redirecting to dashboard...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Initial Data Sync</h2>
        <p className="text-gray-600 mt-2">
          Select what data to sync from your Microsoft 365 tenant
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger bg-opacity-10 border border-danger rounded text-danger">
          {error}
        </div>
      )}

      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Data Types</h3>

        <div className="space-y-3">
          {syncOptions.map(option => (
            <label
              key={option.type}
              className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition"
              style={{
                borderColor: selectedTypes.includes(option.type) ? '#0078d4' : '#e5e7eb'
              }}
            >
              <input
                type="checkbox"
                checked={selectedTypes.includes(option.type)}
                onChange={() => toggleSyncType(option.type)}
                className="mt-1 mr-4 w-5 h-5 text-primary"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{option.icon}</span>
                  <span className="font-semibold text-gray-900">{option.label}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="card bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>First sync may take several minutes</strong> depending on your tenant size.
          You can skip this step and sync later from the dashboard.
        </p>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onComplete}
          className="btn-secondary"
        >
          Skip for Now
        </button>
        <button
          onClick={startSync}
          disabled={selectedTypes.length === 0}
          className="btn-primary"
        >
          Start Sync
        </button>
      </div>
    </div>
  );
}
