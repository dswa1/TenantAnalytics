import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatDate, formatCurrency } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';
import LicenseCostModal from './LicenseCostModal';

export default function LicensesTab({ tenantId }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLicense, setEditingLicense] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);

  useEffect(() => {
    loadLicenses();
  }, [tenantId]);

  async function loadLicenses() {
    try {
      const { data } = await api.get('/api/data/licenses', {
        headers: { 'X-Tenant-ID': tenantId }
      });

      setLicenses(data.licenses || []);
    } catch (error) {
      console.error('Failed to load licenses:', error);
      setLicenses([]);
    } finally {
      setLoading(false);
    }
  }

  function handleEditCost(license) {
    setEditingLicense(license);
    setShowCostModal(true);
  }

  function handleCloseModal() {
    setShowCostModal(false);
    setEditingLicense(null);
  }

  async function handleSaveCost(costData) {
    try {
      await api.put(`/api/data/licenses/${editingLicense.id}/cost`, costData, {
        headers: { 'X-Tenant-ID': tenantId }
      });

      // Reload licenses
      await loadLicenses();
      handleCloseModal();
    } catch (error) {
      console.error('Failed to save license cost:', error);
      throw error;
    }
  }

  const filteredLicenses = licenses.filter(license =>
    license.sku_part_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLicenses = licenses.reduce((sum, l) => sum + (l.consumed_units || 0), 0);

  // Group costs by currency (total = consumed + available)
  const costsByCurrency = licenses.reduce((acc, l) => {
    if (l.cost_per_unit) {
      const currency = l.currency || 'USD';
      const totalUnits = (l.consumed_units || 0) + (l.available_units || 0);
      const cost = l.cost_per_unit * totalUnits;
      acc[currency] = (acc[currency] || 0) + cost;
    }
    return acc;
  }, {});

  // Calculate potential savings (cost of unused licenses)
  const savingsByCurrency = licenses.reduce((acc, l) => {
    if (l.cost_per_unit && l.available_units) {
      const currency = l.currency || 'USD';
      const savings = l.cost_per_unit * l.available_units;
      acc[currency] = (acc[currency] || 0) + savings;
    }
    return acc;
  }, {});

  // Get primary currency (most used or first found)
  const primaryCurrency = Object.keys(costsByCurrency).sort((a, b) =>
    costsByCurrency[b] - costsByCurrency[a]
  )[0] || 'USD';

  const totalCost = costsByCurrency[primaryCurrency] || 0;
  const totalSavings = savingsByCurrency[primaryCurrency] || 0;

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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total License Types</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{licenses.length}</p>
            </div>
            <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Licenses Used</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalLicenses}</p>
            </div>
            <div className="w-12 h-12 bg-success bg-opacity-10 rounded-lg flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Monthly Cost</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {totalCost > 0 ? formatCurrency(totalCost, primaryCurrency) : '-'}
              </p>
              {Object.keys(costsByCurrency).length > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Multiple currencies in use
                </p>
              )}
            </div>
            <div className="w-12 h-12 bg-warning bg-opacity-10 rounded-lg flex items-center justify-center">
              <span className="text-2xl">{getCurrencyIcon(primaryCurrency)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Potential Savings</p>
              <p className="text-3xl font-bold text-success mt-1">
                {totalSavings > 0 ? formatCurrency(totalSavings, primaryCurrency) : '-'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                From unused licenses
              </p>
            </div>
            <div className="w-12 h-12 bg-success bg-opacity-10 rounded-lg flex items-center justify-center">
              <span className="text-2xl">{getCurrencyIcon(primaryCurrency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <input
          type="text"
          placeholder="Search licenses by SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input w-full"
        />
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredLicenses.length} of {licenses.length} licenses
        </div>
      </div>

      {/* Licenses Table */}
      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                License
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Consumed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utilization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost/Unit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Savings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLicenses.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                  No licenses found
                </td>
              </tr>
            ) : (
              filteredLicenses.map(license => {
                const totalUnits = (license.consumed_units || 0) + (license.available_units || 0);
                const totalCost = license.cost_per_unit
                  ? license.cost_per_unit * totalUnits
                  : null;
                const costSavings = license.cost_per_unit && license.available_units
                  ? license.cost_per_unit * license.available_units
                  : null;

                return (
                  <tr key={license.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {license.sku_part_number}
                      </div>
                      {license.cost_notes && (
                        <div className="text-xs text-gray-500 mt-1">
                          {license.cost_notes}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.consumed_units || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.available_units || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className={`h-2 rounded-full ${
                              (license.utilization_percentage || 0) > 90
                                ? 'bg-danger'
                                : (license.utilization_percentage || 0) > 75
                                ? 'bg-warning'
                                : 'bg-success'
                            }`}
                            style={{ width: `${Math.min(license.utilization_percentage || 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {(license.utilization_percentage || 0).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {license.cost_per_unit ? (
                        <div className="flex items-center gap-1">
                          <span className="text-base">{getCurrencyIcon(license.currency || 'USD')}</span>
                          <span>{formatCurrency(license.cost_per_unit, license.currency || 'USD')}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {totalCost ? (
                        <div className="flex items-center gap-1">
                          <span className="text-base">{getCurrencyIcon(license.currency || 'USD')}</span>
                          <span>{formatCurrency(totalCost, license.currency || 'USD')}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {costSavings ? (
                        <div className="flex items-center gap-1">
                          <span className="text-base text-success">{getCurrencyIcon(license.currency || 'USD')}</span>
                          <span className="text-success font-medium">
                            {formatCurrency(costSavings, license.currency || 'USD')}
                          </span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleEditCost(license)}
                        className="text-primary hover:text-primary-dark font-medium"
                      >
                        {license.cost_per_unit ? 'Edit Cost' : 'Set Cost'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cost Modal */}
      {showCostModal && (
        <LicenseCostModal
          license={editingLicense}
          onSave={handleSaveCost}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
