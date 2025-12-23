import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000'
});

// Add auth token to all requests
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// API methods (no credentials exposed - all go to backend)
export const apiService = {
  // Tenants
  getTenants: () => api.get('/api/tenants'),
  createTenant: (data) => api.post('/api/tenants', data),
  getTenant: (tenantId) => api.get(`/api/tenants/${tenantId}`),
  updateTenant: (tenantId, data) =>
    api.put(`/api/tenants/${tenantId}`, data, {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  // Azure Setup (credentials go to backend only - NEVER stored in frontend)
  setupAzure: (tenantId, credentials) =>
    api.post('/api/azure/setup', credentials, {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  getConsentUrl: (tenantId) =>
    api.get('/api/azure/consent-url', {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  checkAzureStatus: (tenantId) =>
    api.get('/api/azure/status', {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  // Data Sync
  startSync: (tenantId, syncTypes) =>
    api.post('/api/sync/start', { sync_types: syncTypes }, {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  getSyncStatus: (syncId) =>
    api.get(`/api/sync/${syncId}/status`),

  getSyncHistory: (tenantId) =>
    api.get('/api/sync/history', {
      headers: { 'X-Tenant-ID': tenantId }
    }),

  getChanges: (tenantId, params) =>
    api.get('/api/sync/changes', {
      headers: { 'X-Tenant-ID': tenantId },
      params
    }),

  // App Usage
  getAppUsage: (tenantId, period = 'D30') =>
    api.get('/api/data/app-usage', {
      headers: { 'X-Tenant-ID': tenantId },
      params: { period }
    }),

  syncAppUsage: (tenantId, period = 'D30') =>
    api.post('/api/data/app-usage/sync', {}, {
      headers: { 'X-Tenant-ID': tenantId },
      params: { period }
    }),

  // Utility
  getPermissions: () => api.get('/api/azure/permissions')
};

export default api;
