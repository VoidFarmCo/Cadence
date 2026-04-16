import api from './apiClient';

export const createEntityAPI = (basePath) => ({
  list: (params) => api.get(basePath, { params }).then((r) => r.data),
  get: (id) => api.get(`${basePath}/${id}`).then((r) => r.data),
  create: (data) => api.post(basePath, data).then((r) => r.data),
  update: (id, data) => api.put(`${basePath}/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`${basePath}/${id}`).then((r) => r.data),
});

export const Accounts = createEntityAPI('/api/accounts');
export const Companies = createEntityAPI('/api/companies');
export const WorkerProfiles = createEntityAPI('/api/worker-profiles');
export const Sites = createEntityAPI('/api/sites');
export const Punches = createEntityAPI('/api/punches');
export const TimeEntries = createEntityAPI('/api/time-entries');
export const Shifts = createEntityAPI('/api/shifts');
export const PayPeriods = createEntityAPI('/api/pay-periods');
export const PayrollRuns = createEntityAPI('/api/payroll-runs');
export const Expenses = createEntityAPI('/api/expenses');
export const LeaveRequests = createEntityAPI('/api/leave-requests');
export const TaxDeductions = createEntityAPI('/api/tax-deductions');
export const TaxForms = createEntityAPI('/api/tax-forms');
export const Messages = createEntityAPI('/api/messages');
export const WorkerDocuments = createEntityAPI('/api/worker-documents');
export const AuditLogs = createEntityAPI('/api/audit-logs');
