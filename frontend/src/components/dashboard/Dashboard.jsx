import { useState, useEffect } from 'react';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { DASHBOARD_TABS } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/formatters';
import OverviewTab from './OverviewTab';
import UsersTab from './UsersTab';
import LicensesTab from './LicensesTab';
import SecurityTab from './SecurityTab';
import MailboxesTab from './MailboxesTab';
import AppUsageTab from './AppUsageTab';
import LoadingSpinner from '../common/LoadingSpinner';

export default function Dashboard() {
  const { currentTenant, tenants, selectTenant } = useTenant();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState(DASHBOARD_TABS.OVERVIEW);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pollTimeoutId, setPollTimeoutId] = useState(null);
  const [pollStartTime, setPollStartTime] = useState(null);

  useEffect(() => {
    if (currentTenant) {
      loadSyncHistory();
    }
  }, [currentTenant]);

  async function loadSyncHistory() {
    try {
      const { data } = await apiService.getSyncHistory(currentTenant.id);
      setSyncHistory(data.syncs || []);
    } catch (error) {
      console.error('Failed to load sync history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    // Prevent multiple simultaneous syncs
    if (syncing) {
      console.warn('Sync already in progress');
      return;
    }

    // Clear any existing poll timeout
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      setPollTimeoutId(null);
    }

    setSyncing(true);
    setPollStartTime(Date.now());

    try {
      console.log('[SYNC] Starting parallel syncs for tenant:', currentTenant.id);

      // Start both syncs in parallel
      const [syncResult, appUsageResult] = await Promise.allSettled([
        apiService.startSync(currentTenant.id, [
          'users', 'licenses', 'mailboxes', 'security_events'
        ]),
        apiService.syncAppUsage(currentTenant.id, 'D30')
      ]);

      console.log('[SYNC] Main sync result:', syncResult.status);
      console.log('[SYNC] App usage sync result:', appUsageResult.status);

      // Check if main sync succeeded
      if (syncResult.status === 'fulfilled') {
        console.log('[SYNC] Main sync started with ID:', syncResult.value.data.sync_id);
        // Poll for main sync status
        pollSyncStatus(syncResult.value.data.sync_id);
      } else {
        console.error('[SYNC] Main sync failed to start:', syncResult.reason);
        setSyncing(false);
        setPollStartTime(null);
        alert('Failed to start sync: ' + syncResult.reason.message);
      }

      // Log app usage sync result
      if (appUsageResult.status === 'fulfilled') {
        console.log('[SYNC] App usage synced:', appUsageResult.value.data.count, 'users');
        console.log('[SYNC] App usage full response:', appUsageResult.value.data);
      } else {
        console.error('[SYNC] App usage sync failed:', appUsageResult.reason);
        console.error('[SYNC] App usage error details:', appUsageResult.reason.response?.data);
      }
    } catch (error) {
      console.error('[SYNC] Sync failed:', error);
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
      alert('Sync is taking longer than expected. Please check the sync history or try again later.');
      return;
    }

    try {
      const { data } = await apiService.getSyncStatus(syncId);

      if (data.status === 'completed' || data.status === 'failed') {
        setSyncing(false);
        setPollStartTime(null);
        setPollTimeoutId(null);
        loadSyncHistory();
        // Force refresh all tabs by updating the refresh key
        setRefreshKey(prev => prev + 1);
      } else {
        // Continue polling every 4 seconds
        const timeoutId = setTimeout(() => pollSyncStatus(syncId), 4000);
        setPollTimeoutId(timeoutId);
      }
    } catch (error) {
      console.error('Status check failed:', error);
      setSyncing(false);
      setPollStartTime(null);
      setPollTimeoutId(null);
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

  function renderTab() {
    if (!currentTenant) return null;

    switch (activeTab) {
      case DASHBOARD_TABS.OVERVIEW:
        return <OverviewTab key={refreshKey} tenantId={currentTenant.id} />;
      case DASHBOARD_TABS.USERS:
        return <UsersTab key={refreshKey} tenantId={currentTenant.id} />;
      case DASHBOARD_TABS.LICENSES:
        return <LicensesTab key={refreshKey} tenantId={currentTenant.id} />;
      case DASHBOARD_TABS.SECURITY:
        return <SecurityTab key={refreshKey} tenantId={currentTenant.id} />;
      case DASHBOARD_TABS.MAILBOXES:
        return <MailboxesTab key={refreshKey} tenantId={currentTenant.id} />;
      case DASHBOARD_TABS.APP_USAGE:
        return <AppUsageTab key={refreshKey} tenantId={currentTenant.id} />;
      default:
        return null;
    }
  }

  const lastSync = syncHistory[0];

  // Auto-redirect to onboarding if no tenant exists
  useEffect(() => {
    if (!loading && tenants.length === 0) {
      window.location.href = '/onboarding';
    }
  }, [loading, tenants]);

  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4">No Tenant Selected</h2>
          <p className="text-gray-600 mb-4">
            You haven't set up a tenant yet. Complete the onboarding to get started.
          </p>
          <a href="/onboarding" className="btn-primary inline-block">
            Start Onboarding
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">M365 Tenant Manager</h1>

              {/* Tenant Selector */}
              {tenants.length > 1 && (
                <select
                  value={currentTenant.id}
                  onChange={(e) => {
                    const tenant = tenants.find(t => t.id === e.target.value);
                    selectTenant(tenant);
                  }}
                  className="input max-w-xs"
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.tenant_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3">
              {lastSync && (
                <div className="text-sm text-gray-600">
                  Last sync: {formatRelativeTime(lastSync.started_at)}
                  {lastSync.status && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                      lastSync.status === 'completed' ? 'bg-green-100 text-green-800' :
                      lastSync.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {lastSync.status}
                    </span>
                  )}
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-primary"
              >
                {syncing ? 'Syncing...' : 'Sync Data'}
              </button>

              <button onClick={signOut} className="btn-secondary">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            {Object.values(DASHBOARD_TABS).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? <LoadingSpinner /> : renderTab()}
      </main>
    </div>
  );
}
