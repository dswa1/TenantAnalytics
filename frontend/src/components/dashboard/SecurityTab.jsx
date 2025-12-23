import { useState, useEffect } from 'react';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SecurityTab({ tenantId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');

  useEffect(() => {
    loadSecurityEvents();
  }, [tenantId]);

  async function loadSecurityEvents() {
    try {
      const { data } = await api.get('/api/data/security-events', {
        headers: { 'X-Tenant-ID': tenantId },
        params: { limit: 100 }
      });

      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load security events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredEvents = events.filter(event => {
    if (severityFilter === 'all') return true;
    return event.severity?.toLowerCase() === severityFilter;
  });

  function getSeverityColor(severity) {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'bg-danger bg-opacity-10 text-danger border-danger';
      case 'medium':
        return 'bg-warning bg-opacity-10 text-warning border-warning';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Total Events</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{events.length}</p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">High Severity</p>
          <p className="text-3xl font-bold text-danger mt-2">
            {events.filter(e => e.severity === 'high').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gray-600">Medium Severity</p>
          <p className="text-3xl font-bold text-warning mt-2">
            {events.filter(e => e.severity === 'medium').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="input w-48"
        >
          <option value="all">All Severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>

        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            <p>No security events found</p>
            <p className="text-sm mt-2">Security events will appear here after syncing</p>
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <div key={index} className={`card border-l-4 ${getSeverityColor(event.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded uppercase ${getSeverityColor(event.severity)}`}>
                      {event.severity || 'Unknown'}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-2">
                    {event.event_type || 'Security Event'}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {event.user_id && (
                      <div>
                        <span className="text-gray-500">User ID:</span>{' '}
                        <span className="text-gray-900">{event.user_id}</span>
                      </div>
                    )}
                    {event.device_id && (
                      <div>
                        <span className="text-gray-500">Device ID:</span>{' '}
                        <span className="text-gray-900">{event.device_id}</span>
                      </div>
                    )}
                    {event.resolved !== null && (
                      <div>
                        <span className="text-gray-500">Resolved:</span>{' '}
                        <span className="text-gray-900">{event.resolved ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                    {event.notes && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Notes:</span>{' '}
                        <span className="text-gray-900">{event.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
