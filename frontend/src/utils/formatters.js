import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(dateString, formatStr = 'MMM d, yyyy') {
  if (!dateString) return 'Never';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, formatStr);
  } catch (error) {
    return 'Invalid date';
  }
}

export function formatDateTime(dateString) {
  return formatDate(dateString, 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Never';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch (error) {
    return 'Invalid date';
  }
}

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return 'N/A';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString();
}

export function formatPercentage(value, total) {
  if (!total || total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

export function formatChangeType(changeType) {
  const types = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    modified: 'Modified'
  };
  return types[changeType] || changeType;
}

export function formatSyncStatus(status) {
  const statuses = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    failed: 'Failed',
    partial: 'Partial'
  };
  return statuses[status] || status;
}

export function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function formatCurrency(amount, currency = 'USD', decimals = 2) {
  if (amount === null || amount === undefined) return 'N/A';

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount);
  } catch (error) {
    // Fallback if currency is not supported
    return `${currency} ${amount.toFixed(decimals)}`;
  }
}
