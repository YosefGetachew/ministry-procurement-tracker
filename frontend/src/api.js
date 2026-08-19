async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed with status ${res.status}`);
  }
  return data;
}

function get(url) {
  return fetch(url, { credentials: 'include' }).then(handle);
}

function send(url, method, payload) {
  return fetch(url, {
    method,
    credentials: 'include',
    headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  }).then(handle);
}

export const api = {
  // Auth
  login: (email, password) => send('/api/auth/login', 'POST', { email, password }),
  logout: () => send('/api/auth/logout', 'POST'),
  changePassword: (currentPassword, newPassword) => send('/api/auth/change-password', 'POST', { currentPassword, newPassword }),
  me: () => get('/api/auth/me'),
  getMeta: () => get('/api/meta'),

  // Projects (Director) / My Projects (Officer)
  listProjects: () => get('/api/projects'),
  listSectors: () => get('/api/sectors'),
  createSector: (payload) => send('/api/sectors', 'POST', payload),
  updateSector: (id, payload) => send(`/api/sectors/${id}`, 'PUT', payload),
  setSectorActive: (id, isActive) => send(`/api/sectors/${id}`, 'PATCH', { isActive }),
  deleteSector: (id) => send(`/api/sectors/${id}`, 'DELETE'),
  listLookupOptions: (listKey) => get(`/api/settings/options?listKey=${encodeURIComponent(listKey)}`),
  createLookupOption: (payload) => send('/api/settings/options', 'POST', payload),
  updateLookupOption: (id, payload) => send(`/api/settings/options/${id}`, 'PUT', payload),
  setLookupOptionActive: (id, isActive) => send(`/api/settings/options/${id}`, 'PATCH', { isActive }),
  listLeadership: () => get('/api/settings/leadership'),
  createLeadership: (payload) => send('/api/settings/leadership', 'POST', payload),
  updateLeadership: (id, payload) => send(`/api/settings/leadership/${id}`, 'PUT', payload),
  setLeadershipActive: (id, isActive) => send(`/api/settings/leadership/${id}`, 'PATCH', { isActive }),
  deleteLeadership: (id) => send(`/api/settings/leadership/${id}`, 'DELETE'),
  createProject: (payload) => send('/api/projects', 'POST', payload),
  updateProject: (id, payload) => send(`/api/projects/${id}`, 'PUT', payload),
  listMyProjects: () => get('/api/my-projects'),
  listOfficers: () => get('/api/officers'),
  listAssignments: (projectId) => get(`/api/projects/${projectId}/assignments`),
  assignOfficer: (projectId, officerId) => send(`/api/projects/${projectId}/assignments`, 'POST', { officerId }),
  setAssignmentActive: (assignmentId, isActive) => send(`/api/assignments/${assignmentId}`, 'PATCH', { isActive }),

  // Plans
  listPlans: () => get('/api/plans'),
  getPlan: (id) => get(`/api/plans/${id}`),
  createPlan: (payload) => send('/api/plans', 'POST', payload),
  updatePlan: (id, payload) => send(`/api/plans/${id}`, 'PUT', payload),
  addActivity: (planId, payload) => send(`/api/plans/${planId}/activities`, 'POST', payload),
  submitPlan: (id) => send(`/api/plans/${id}/submit`, 'POST'),
  directorReview: (id, decision, comment) => send(`/api/plans/${id}/director-review`, 'POST', { decision, comment }),
  castVote: (id, decision, comment) => send(`/api/plans/${id}/votes`, 'POST', { decision, comment }),
  managementDecision: (id, decision, comment) => send(`/api/plans/${id}/management-decision`, 'POST', { decision, comment }),
  getApprovalSummary: (id) => get(`/api/plans/${id}/approval-summary`),

  // Stages
  updateStage: (id, payload) => send(`/api/stages/${id}`, 'PATCH', payload),
  replanStage: (id, newDate, reason) => send(`/api/stages/${id}/replan`, 'POST', { newDate, reason }),

  // Contracts / suppliers / payments
  listSuppliers: () => get('/api/suppliers'),
  createSupplier: (payload) => send('/api/suppliers', 'POST', payload),
  listContracts: () => get('/api/contracts'),
  createContract: (payload) => send('/api/contracts', 'POST', payload),
  updateContract: (id, payload) => send(`/api/contracts/${id}`, 'PUT', payload),
  addPayment: (contractId, payload) => send(`/api/contracts/${contractId}/payments`, 'POST', payload),

  // Alerts / dashboard
  listAlerts: () => get('/api/alerts'),
  markAlertRead: (id) => send(`/api/alerts/${id}/read`, 'PATCH'),
  getDashboard: () => get('/api/dashboard'),
  getExecutiveDashboard: (filters = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined));
    return get(`/api/executive-dashboard${query.size ? `?${query}` : ''}`);
  },
  previewReport: (code) => get(`/api/reports/${code}/preview`),
  reportExportUrl: (code, format) => `/api/reports/${code}/export?format=${format}`,

  // Admin
  listUsers: () => get('/api/admin/users'),
  createUser: (payload) => send('/api/admin/users', 'POST', payload),
  updateUser: (id, payload) => send(`/api/admin/users/${id}`, 'PATCH', payload),
  listCommittee: () => get('/api/admin/committee'),
  addCommitteeMember: (userId) => send('/api/admin/committee', 'POST', { userId }),
  setCommitteeMemberActive: (id, isActive) => send(`/api/admin/committee/${id}`, 'PATCH', { isActive }),
  listCommittees: () => get('/api/admin/committees'),
  registerCommitteeMember: (payload) => send('/api/admin/committees/register', 'POST', payload),
  updateEndorsingCommitteeMember: (id, payload) => send(`/api/admin/committees/endorsing/${id}`, 'PUT', payload),
  setRegisteredCommitteeMemberActive: (committeeType, id, isActive) => send(`/api/admin/committees/${committeeType}/${id}`, 'PATCH', { isActive }),
  removeCommitteeMember: (committeeType, id) => send(`/api/admin/committees/${committeeType}/${id}`, 'DELETE'),
};
