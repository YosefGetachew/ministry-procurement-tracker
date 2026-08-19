// Populated from GET /api/meta at startup (see auth/AuthContext.jsx) so the
// domain vocabulary has one source of truth (backend/constants.js).
export let CATEGORIES = [];
export let CATEGORY_CODES = {};
export let METHODS = [];
export let STAGE_TEMPLATES = {};
export let RFB_PREQUALIFICATION_STAGES = [];
export let ACTUAL_ONLY_STAGES = [];
export let ACTIVITY_FIELDS = [];
export let METHOD_FIELDS = {};
export let CATEGORY_FIELDS = {};
export let PLAN_STATUSES = [];
export let STAGE_STATUSES = [];
export let COMMITTEE_SIZE = 5;
export let COMMITTEE_APPROVAL_THRESHOLD = 3;
export let COMMITTEE_REJECT_THRESHOLD = 3;

export function setMeta(meta) {
  CATEGORIES = meta.CATEGORIES;
  CATEGORY_CODES = meta.CATEGORY_CODES;
  METHODS = meta.METHODS;
  STAGE_TEMPLATES = meta.STAGE_TEMPLATES;
  RFB_PREQUALIFICATION_STAGES = meta.RFB_PREQUALIFICATION_STAGES || [];
  ACTUAL_ONLY_STAGES = meta.ACTUAL_ONLY_STAGES || [];
  ACTIVITY_FIELDS = meta.ACTIVITY_FIELDS || [];
  METHOD_FIELDS = meta.METHOD_FIELDS || {};
  CATEGORY_FIELDS = meta.CATEGORY_FIELDS;
  PLAN_STATUSES = meta.PLAN_STATUSES;
  STAGE_STATUSES = meta.STAGE_STATUSES;
  COMMITTEE_SIZE = meta.COMMITTEE_SIZE;
  COMMITTEE_APPROVAL_THRESHOLD = meta.COMMITTEE_APPROVAL_THRESHOLD;
  COMMITTEE_REJECT_THRESHOLD = meta.COMMITTEE_REJECT_THRESHOLD;
}

export function methodsForCategory(category) {
  return METHODS.filter((m) => m.categories.includes(category));
}

export function stagesForMethod(method, categoryData = {}) {
  const definition = METHODS.find((item) => item.code === method);
  if (!definition) return [];
  const stages = STAGE_TEMPLATES[definition.family] || [];
  return definition.family === 'RFB' && categoryData.prequalification
    ? [...RFB_PREQUALIFICATION_STAGES, ...stages]
    : stages;
}

export function stageRequiresPlannedDate(stageName) {
  return !ACTUAL_ONLY_STAGES.includes(stageName);
}

export function fieldsForMethod(method) {
  const definition = METHODS.find((item) => item.code === method);
  return definition ? (METHOD_FIELDS[definition.family] || []) : [];
}

export const PLAN_STATUS_META = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED_TO_DIRECTOR: { label: 'Submitted to Director', tone: 'pending' },
  RETURNED_FOR_CORRECTION: { label: 'Returned for correction', tone: 'warning' },
  REJECTED_BY_DIRECTOR: { label: 'Rejected by Director', tone: 'danger' },
  DIRECTOR_APPROVED: { label: 'Director approved', tone: 'pending' },
  COMMITTEE_REVIEW: { label: 'Committee review', tone: 'pending' },
  MANAGEMENT_REVIEW: { label: 'Management approval', tone: 'pending' },
  FINALLY_APPROVED: { label: 'Finally approved', tone: 'success' },
  REJECTED_BY_COMMITTEE: { label: 'Rejected by committee', tone: 'danger' },
  REJECTED_BY_MANAGEMENT: { label: 'Rejected by management', tone: 'danger' },
  REPLANNED: { label: 'Replanned', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};

export const ROLE_LABELS = {
  officer: 'Procurement Officer',
  director: 'Procurement Director',
  committee: 'Endorsing Committee Member',
  management: 'Ministry Management Member',
  admin: 'Administrator',
};

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

// Effective target date = revised date when present, otherwise original (SDD 8.1).
export function effectiveTargetDate(stage) {
  return stage.revisedDate || stage.originalDate || null;
}

export function stageDelayDays(stage) {
  const target = effectiveTargetDate(stage);
  if (!target) return 0;
  const comparisonDate = stage.status === 'Completed' ? stage.actualDate : new Date();
  if (!comparisonDate) return 0;
  return Math.max(0, daysBetween(target, comparisonDate));
}

export function formatETB(n) {
  return new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(n) + ' ETB';
}

export function formatMoney(n, currency = 'ETB') {
  return `${new Intl.NumberFormat('en-ET', { maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

export function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function initials(name) {
  return (name || '')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
