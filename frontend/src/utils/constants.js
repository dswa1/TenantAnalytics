// Sync types
export const SYNC_TYPES = {
  USERS: 'users',
  LICENSES: 'licenses',
  MAILBOXES: 'mailboxes',
  SECURITY_EVENTS: 'security_events'
};

// Sync statuses
export const SYNC_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

// Change types
export const CHANGE_TYPES = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  MODIFIED: 'modified'
};

// Subscription tiers
export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
};

// Tier limits
export const TIER_LIMITS = {
  free: {
    max_tenants: 1,
    max_users: 100,
    sync_frequency_hours: 24,
    data_retention_days: 30
  },
  pro: {
    max_tenants: 5,
    max_users: 1000,
    sync_frequency_hours: 6,
    data_retention_days: 90
  },
  enterprise: {
    max_tenants: -1, // unlimited
    max_users: -1, // unlimited
    sync_frequency_hours: 1,
    data_retention_days: 365
  }
};

// User roles
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer'
};

// Azure permissions required
export const AZURE_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All',
  'MailboxSettings.Read',
  'SecurityEvents.Read.All',
  'AuditLog.Read.All'
];

// Dashboard tabs
export const DASHBOARD_TABS = {
  OVERVIEW: 'overview',
  USERS: 'users',
  LICENSES: 'licenses',
  SECURITY: 'security',
  MAILBOXES: 'mailboxes',
  APP_USAGE: 'app usage'
};

// Colors for charts (Microsoft palette)
export const CHART_COLORS = {
  primary: '#0078d4',
  secondary: '#50e6ff',
  success: '#10893e',
  warning: '#ffb900',
  danger: '#d13438',
  info: '#8764b8',
  gray: '#605e5c'
};

// Status colors
export const STATUS_COLORS = {
  active: 'text-success',
  inactive: 'text-gray-500',
  pending: 'text-warning',
  failed: 'text-danger',
  completed: 'text-success'
};
