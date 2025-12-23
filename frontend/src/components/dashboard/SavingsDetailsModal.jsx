import { useState } from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function SavingsDetailsModal({ users, savingsData, onClose }) {
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('savings');

  if (!users || users.length === 0) {
    return null;
  }

  // Filter users by issue type
  const filteredUsers = filterType === 'all'
    ? users
    : users.filter(u => u.issue_type === filterType);

  // Sort users
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === 'savings') {
      return b.potential_savings - a.potential_savings;
    } else if (sortBy === 'name') {
      return (a.display_name || '').localeCompare(b.display_name || '');
    } else if (sortBy === 'days') {
      return (b.days_inactive || 0) - (a.days_inactive || 0);
    }
    return 0;
  });

  const totalSavings = savingsData?.primary_savings || 0;
  const currency = savingsData?.primary_currency || 'USD';
  const breakdown = savingsData?.savings_breakdown || {};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Cost Optimization Opportunities</h2>
              <p className="text-sm text-gray-600 mt-1">
                Total Monthly Savings: <span className="font-semibold text-success">{formatCurrency(totalSavings, currency)}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Savings Breakdown */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Unused Licenses</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(breakdown.unused_licenses || 0, currency)}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Inactive Users</p>
              <p className="text-lg font-bold text-orange-700">{formatCurrency(breakdown.inactive_users || 0, currency)}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Underutilized Apps</p>
              <p className="text-lg font-bold text-purple-700">{formatCurrency(breakdown.underutilized_apps || 0, currency)}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Issues ({users.length})</option>
                <option value="inactive_user">Inactive Users ({users.filter(u => u.issue_type === 'inactive_user').length})</option>
                <option value="unused_license">Unused Licenses ({users.filter(u => u.issue_type === 'unused_license').length})</option>
                <option value="underutilized_app">Underutilized Apps ({users.filter(u => u.issue_type === 'underutilized_app').length})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="savings">Potential Savings</option>
                <option value="name">User Name</option>
                <option value="days">Days Inactive</option>
              </select>
            </div>

            <div className="ml-auto text-sm text-gray-600">
              Showing {sortedUsers.length} of {users.length} users
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days Inactive</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Licenses</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Potential Savings</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedUsers.map((user, index) => (
                <tr key={user.user_principal_name || `item-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">{user.display_name}</div>
                      {user.user_principal_name && (
                        <div className="text-xs text-gray-500">{user.user_principal_name}</div>
                      )}
                      {user.available_units && (
                        <div className="text-xs text-blue-600 font-medium">{user.available_units} unit{user.available_units !== 1 ? 's' : ''} available</div>
                      )}
                      {user.app_name && (
                        <div className="text-xs text-purple-600 font-medium">App: {user.app_name}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.issue_type === 'inactive_user' ? 'bg-orange-100 text-orange-800' :
                      user.issue_type === 'unused_license' ? 'bg-blue-100 text-blue-800' :
                      user.issue_type === 'underutilized_app' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.issue_type === 'inactive_user' ? 'Inactive User' :
                       user.issue_type === 'unused_license' ? 'Unused License' :
                       user.issue_type === 'underutilized_app' ? 'Underutilized App' :
                       user.issue_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.issue_type === 'unused_license' ? 'N/A' :
                     user.days_inactive !== null ? `${user.days_inactive} days` : 'Never used'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {user.assigned_licenses?.map((license, idx) => (
                        <div key={idx} className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{license.sku_part_number}</span>
                          <span className="text-xs text-gray-500">
                            ({formatCurrency(license.cost_per_unit, license.currency)}/mo)
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-success">
                      {formatCurrency(user.potential_savings, user.currency)}
                    </div>
                    <div className="text-xs text-gray-500">per month</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No users found for the selected filter</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <p className="font-medium">Recommendations:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>Review inactive users and consider removing unused licenses</li>
                <li>Verify user status before making changes</li>
                <li>Contact users before license removal to confirm inactivity</li>
              </ul>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
