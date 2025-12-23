import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';

const TenantContext = createContext({});

export function TenantProvider({ children }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTenants();
    } else {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
    }
  }, [user]);

  async function loadTenants() {
    try {
      const { data } = await apiService.getTenants();
      setTenants(data.tenants || []);

      // Auto-select first tenant if only one exists
      if (data.tenants?.length === 1) {
        setCurrentTenant(data.tenants[0]);
      }

      // Restore previously selected tenant from localStorage
      const savedTenantId = localStorage.getItem('selectedTenantId');
      if (savedTenantId && data.tenants) {
        const savedTenant = data.tenants.find(t => t.id === savedTenantId);
        if (savedTenant) {
          setCurrentTenant(savedTenant);
        }
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoading(false);
    }
  }

  function selectTenant(tenant) {
    setCurrentTenant(tenant);
    // Save to localStorage for persistence
    if (tenant?.id) {
      localStorage.setItem('selectedTenantId', tenant.id);
    }
  }

  async function createTenant(tenantData) {
    try {
      const { data } = await apiService.createTenant(tenantData);
      const newTenant = data.tenant;
      setTenants(prev => [...prev, newTenant]);
      setCurrentTenant(newTenant);
      localStorage.setItem('selectedTenantId', newTenant.id);
      return { data: newTenant, error: null };
    } catch (error) {
      return { data: null, error: error.response?.data?.message || 'Failed to create tenant' };
    }
  }

  async function refreshTenants() {
    await loadTenants();
  }

  const value = {
    tenants,
    currentTenant,
    loading,
    selectTenant,
    createTenant,
    refreshTenants
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
