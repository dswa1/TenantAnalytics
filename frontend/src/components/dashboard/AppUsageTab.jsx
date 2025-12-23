import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatDate, formatRelativeTime } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

export default function AppUsageTab({ tenantId }) {
  const [appUsage, setAppUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('D30');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    loadAppUsage();
  }, [tenantId, period]);

  async function loadAppUsage() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiService.getAppUsage(tenantId, period);

      setAppUsage(data.data || []);
      setLastSync(data.last_sync);
    } catch (error) {
      console.error('Failed to load app usage:', error);
      setError(error.response?.data?.message || 'Failed to load app usage data');
      setAppUsage([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredData = appUsage.filter(user => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();

    return (
      user.user_principal_name?.toLowerCase().includes(searchLower) ||
      user.display_name?.toLowerCase().includes(searchLower)
    );
  });

  // Get app license columns
  const appLicenseColumns = [
    { key: 'has_exchange_license', label: 'Exchange' },
    { key: 'has_onedrive_license', label: 'OneDrive' },
    { key: 'has_sharepoint_license', label: 'SharePoint' },
    { key: 'has_skype_license', label: 'Skype' },
    { key: 'has_yammer_license', label: 'Yammer' },
    { key: 'has_teams_license', label: 'Teams' }
  ];

  // Get last activity columns
  const activityColumns = [
    { key: 'exchange_last_activity_date', label: 'Exchange' },
    { key: 'onedrive_last_activity_date', label: 'OneDrive' },
    { key: 'sharepoint_last_activity_date', label: 'SharePoint' },
    { key: 'teams_last_activity_date', label: 'Teams' }
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <div className="text-red-600 mb-4">{error}</div>
          <button onClick={loadAppUsage} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input w-48"
          >
            <option value="D30">Last 30 Days</option>
            <option value="D90">Last 90 Days</option>
            <option value="D180">Last 180 Days</option>
          </select>
        </div>

        <div className="mt-4 flex justify-between text-sm text-gray-600">
          <span>Showing {filteredData.length} of {appUsage.length} users</span>
          {lastSync && (
            <span>Last synced: {formatRelativeTime(lastSync)}</span>
          )}
        </div>
      </div>

      {/* App Usage Table */}
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Display Name
              </th>
              {appLicenseColumns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {col.label}
                </th>
              ))}
              {activityColumns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {col.label} Activity
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={appLicenseColumns.length + activityColumns.length + 2} className="px-6 py-8 text-center text-gray-500">
                  {appUsage.length === 0 ? 'No data available. Click the main "Sync Data" button to load data.' : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredData.map((user, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                        {user.display_name?.[0]?.toUpperCase() || user.user_principal_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.user_principal_name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.display_name || '-'}
                  </td>
                  {appLicenseColumns.map(col => (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        user[col.key]
                          ? 'bg-success bg-opacity-10 text-success'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user[col.key] ? 'Yes' : 'No'}
                      </span>
                    </td>
                  ))}
                  {activityColumns.map(col => (
                    <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user[col.key]) || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      {appUsage.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="text-sm text-gray-500">Total Users</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {appUsage.length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Period</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {period === 'D30' ? '30 Days' : period === 'D90' ? '90 Days' : '180 Days'}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">With Licenses</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {appUsage.filter(u => u.has_exchange_license || u.has_onedrive_license || u.has_sharepoint_license || u.has_teams_license).length}
            </div>
          </div>
          <div className="card">
            <div className="text-sm text-gray-500">Recently Active</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {appUsage.filter(u => u.exchange_last_activity_date || u.onedrive_last_activity_date || u.sharepoint_last_activity_date || u.teams_last_activity_date).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
