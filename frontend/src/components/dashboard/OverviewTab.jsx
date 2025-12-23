import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatNumber, formatBytes, formatRelativeTime, formatCurrency } from '../../utils/formatters';
import StatsCard from '../common/StatsCard';
import LoadingSpinner from '../common/LoadingSpinner';
import SavingsDetailsModal from './SavingsDetailsModal';
import api from '../../services/api';

export default function OverviewTab({ tenantId }) {
  const [stats, setStats] = useState(null);
  const [changes, setChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSavingsModal, setShowSavingsModal] = useState(false);

  useEffect(() => {
    loadOverview();
  }, [tenantId]);

  async function loadOverview() {
    try {
      console.log('Loading overview for tenant:', tenantId);

      // Load statistics from backend API
      const [usersResponse, licensesResponse, mailboxesResponse, securityResponse, savingsResponse] = await Promise.all([
        api.get('/api/tenants/stats/users', { headers: { 'X-Tenant-ID': tenantId } }),
        api.get('/api/tenants/stats/licenses', { headers: { 'X-Tenant-ID': tenantId } }),
        api.get('/api/tenants/stats/mailboxes', { headers: { 'X-Tenant-ID': tenantId } }),
        api.get('/api/tenants/stats/security', { headers: { 'X-Tenant-ID': tenantId } }),
        api.get('/api/tenants/stats/cost-savings', { headers: { 'X-Tenant-ID': tenantId } })
      ].map(p => p.catch(e => ({ data: { count: 0, total: 0, primary_savings: 0, users_count: 0, users_needing_attention: [] } }))));

      console.log('API responses:', { usersResponse, licensesResponse, mailboxesResponse, securityResponse, savingsResponse });

      setStats({
        totalUsers: usersResponse.data?.count || 0,
        totalLicenses: licensesResponse.data?.count || 0,
        totalStorage: mailboxesResponse.data?.total || 0,
        securityEvents: securityResponse.data?.count || 0,
        costSavings: savingsResponse.data?.primary_savings || 0,
        savingsCurrency: savingsResponse.data?.primary_currency || 'USD',
        savingsUsers: savingsResponse.data?.users_needing_attention || [],
        savingsData: savingsResponse.data
      });

      // Load recent changes
      try {
        const { data: changesData } = await apiService.getChanges(tenantId, {
          limit: 10
        });
        // Handle different response structures
        const changesArray = Array.isArray(changesData)
          ? changesData
          : (changesData?.changes || []);
        setChanges(changesArray);
      } catch (err) {
        console.error('Failed to load changes:', err);
        setChanges([]);
      }
    } catch (error) {
      console.error('Failed to load overview:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={formatNumber(stats?.totalUsers)}
          icon={<span className="text-2xl">👥</span>}
          colorClass="text-primary"
        />
        <StatsCard
          title="Licenses"
          value={formatNumber(stats?.totalLicenses)}
          icon={<span className="text-2xl">📋</span>}
          colorClass="text-secondary"
        />
        <StatsCard
          title="Total Storage"
          value={formatBytes(stats?.totalStorage)}
          icon={<span className="text-2xl">💾</span>}
          colorClass="text-success"
        />
        <StatsCard
          title="Security Events"
          value={formatNumber(stats?.securityEvents)}
          icon={<span className="text-2xl">🔒</span>}
          colorClass="text-warning"
        />
      </div>

      {/* Cost Savings Card */}
      <div className="grid grid-cols-1 gap-6">
        <StatsCard
          title="Potential Monthly Savings"
          value={formatCurrency(stats?.costSavings || 0, stats?.savingsCurrency)}
          subtitle={stats?.savingsUsers?.length > 0
            ? `${stats.savingsUsers.length} optimization opportunit${stats.savingsUsers.length !== 1 ? 'ies' : 'y'} - click to view details`
            : stats?.costSavings > 0
            ? 'Click to view savings opportunities'
            : 'Add license costs to see savings opportunities'}
          icon={<span className="text-2xl">💰</span>}
          colorClass="text-success"
          onClick={() => stats?.savingsUsers?.length > 0 && setShowSavingsModal(true)}
          clickable={stats?.savingsUsers?.length > 0}
        />
      </div>

      {/* Recent Changes */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Recent Changes</h2>
          <a href="#changes" className="text-sm text-primary hover:underline">
            View All
          </a>
        </div>

        {!Array.isArray(changes) || changes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No changes detected yet</p>
            <p className="text-sm mt-2">Changes will appear here after your next sync</p>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  change.change_type === 'created' ? 'bg-success' :
                  change.change_type === 'updated' ? 'bg-warning' :
                  change.change_type === 'deleted' ? 'bg-danger' :
                  'bg-gray-400'
                }`} />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {change.entity_type} {change.change_type}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {change.entity_name || change.entity_id}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(change.changed_at)}
                    </span>
                  </div>
                  {change.field_name && (
                    <p className="text-sm text-gray-500 mt-2">
                      {change.field_name}: {change.old_value} → {change.new_value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card hover:shadow-lg transition cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">View Users</h3>
          <p className="text-sm text-gray-600">
            Browse and manage user accounts
          </p>
        </div>
        <div className="card hover:shadow-lg transition cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">Security Events</h3>
          <p className="text-sm text-gray-600">
            Review security alerts and logs
          </p>
        </div>
        <div className="card hover:shadow-lg transition cursor-pointer">
          <h3 className="font-semibold text-gray-900 mb-2">Mailbox Usage</h3>
          <p className="text-sm text-gray-600">
            Check mailbox sizes and quotas
          </p>
        </div>
      </div>

      {/* Savings Details Modal */}
      {showSavingsModal && (
        <SavingsDetailsModal
          users={stats?.savingsUsers}
          savingsData={stats?.savingsData}
          onClose={() => setShowSavingsModal(false)}
        />
      )}
    </div>
  );
}
