import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatBytes, formatNumber, formatDate } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

export default function MailboxesTab({ tenantId }) {
  const [mailboxes, setMailboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('size_desc');

  useEffect(() => {
    loadMailboxes();
  }, [tenantId]);

  async function loadMailboxes() {
    try {
      const { data } = await api.get('/api/data/mailboxes', {
        headers: { 'X-Tenant-ID': tenantId }
      });

      setMailboxes(data.mailboxes || []);
    } catch (error) {
      console.error('Failed to load mailboxes:', error);
      setMailboxes([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredAndSorted = mailboxes
    .filter(mailbox =>
      mailbox.user_principal_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'size_desc':
          return (b.storage_used_bytes || 0) - (a.storage_used_bytes || 0);
        case 'size_asc':
          return (a.storage_used_bytes || 0) - (b.storage_used_bytes || 0);
        case 'items_desc':
          return (b.item_count || 0) - (a.item_count || 0);
        case 'name_asc':
          return (a.user_principal_name || '').localeCompare(b.user_principal_name || '');
        default:
          return 0;
      }
    });

  const totalStorage = mailboxes.reduce((sum, m) => sum + (m.storage_used_bytes || 0), 0);
  const totalItems = mailboxes.reduce((sum, m) => sum + (m.item_count || 0), 0);
  const avgSize = mailboxes.length > 0 ? totalStorage / mailboxes.length : 0;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Mailboxes</p>
          <p className="text-3xl font-bold text-primary mt-2">{formatNumber(mailboxes.length)}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Storage</p>
          <p className="text-3xl font-bold text-success mt-2">{formatBytes(totalStorage)}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Average Size</p>
          <p className="text-3xl font-bold text-secondary mt-2">{formatBytes(avgSize)}</p>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="card">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search mailboxes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input flex-1"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input w-48"
          >
            <option value="size_desc">Largest First</option>
            <option value="size_asc">Smallest First</option>
            <option value="items_desc">Most Items</option>
            <option value="name_asc">Name A-Z</option>
          </select>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredAndSorted.length} of {mailboxes.length} mailboxes
        </div>
      </div>

      {/* Mailboxes Table */}
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Count
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quota
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  No mailboxes found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((mailbox, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {mailbox.user_principal_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{mailbox.user_principal_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatBytes(mailbox.storage_used_bytes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatNumber(mailbox.item_count)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(mailbox.updated_at)}
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
