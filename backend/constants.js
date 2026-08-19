// Single source of truth for the domain vocabulary shared by every route.
// The frontend fetches this via GET /api/meta instead of hardcoding a copy.
// Mirrors SDD v1.2 sections 7.5 (category data), 11.3 (category fields) and
// 11.4 (method-to-template mapping).

const CATEGORIES = ['Goods', 'Works', 'Non-Consulting Services', 'Consultancy Services'];

// Used to build generated plan/activity references (SDD 20.2 default: {ProjectCode}-{FiscalYear}-{CategoryCode}-{seq}).
const CATEGORY_CODES = {
  Goods: 'GD',
  Works: 'WK',
  'Non-Consulting Services': 'NC',
  'Consultancy Services': 'CS',
};

// Ordered stage-name templates per method family (SDD 11.4).
const STAGE_TEMPLATES = {
  RFB: ['Draft Bidding Documents', 'Specific Procurement Notice', 'Invitation to Providers', 'Amendments to Bidding Documents', 'Bid Submission / Opening / Minutes', 'Bid Evaluation Report and Recommendation for Award', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  RFQ: ['Draft Request for Quotations', 'Specific Procurement Notice', 'Invitation to Supplier / Contractor', 'Amendments to Request for Quotations', 'Receive Quotations', 'Comparison of Quotations', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  Direct: ['Justification for Direct Procurement', 'Invitation to Supplier / Contractor', 'Draft Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  UN: ['Justification for Direct Procurement', 'Invitation to Supplier / Contractor', 'Draft Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  ConsultancyFirm: ['Terms of Reference', 'Expression of Interest', 'Evaluation of Expression of Interest and Short List of Consultants', 'Short List and Draft Request for Proposals', 'Request for Proposals as Issued', 'Amendments to Request for Proposals', 'Opening of Technical Proposals / Minutes', 'Evaluation of Technical Proposals', 'Opening of Financial Proposals / Minutes', 'Combined Evaluation Report and Draft Negotiated Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  ConsultantQualification: ['Terms of Reference', 'Expression of Interest', 'Evaluation of Expression of Interest and Short List of Consultants', 'Short List and Draft Request for Proposals', 'Draft Negotiated Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  IndividualConsultant: ['Terms of Reference', 'Expression of Interest', 'Evaluation of Expression of Interest and Short List of Consultants', 'Justification for Direct Selection', 'Invitation to Identified / Selected Consultant', 'Draft Negotiated Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
  NpoBankAgent: ['Terms of Reference', 'Expression of Interest', 'Evaluation of Expression of Interest and Short List of Consultants', 'Justification for Direct Selection', 'Short List and Draft Request for Proposals', 'Invitation to Identified / Selected Consultant', 'Amendments of Terms of Reference', 'Draft Negotiated Contract', 'Notification of Intention of Award', 'Signed Contract', 'Contract Amendments', 'Contract Completion', 'Contract Termination'],
};

const RFB_PREQUALIFICATION_STAGES = ['Draft Pre-qualification Documents', 'Specific Procurement Notice (Pre-qualification)', 'Amendments to Pre-qualification Documents', 'Opening / Minutes of Pre-qualification', 'Pre-qualification Evaluation Report'];

// The STEP workbook records these as actual-event columns only. They belong in
// the activity history, but do not require an artificial planned date.
const ACTUAL_ONLY_STAGES = [
  'Amendments to Pre-qualification Documents',
  'Amendments to Bidding Documents',
  'Amendments to Request for Quotations',
  'Amendments to Request for Proposals',
  'Amendments of Terms of Reference',
  'Contract Amendments',
  'Contract Termination',
];

// Procurement methods, grouped into the families above, scoped to the plan
// categories they're applicable under (SDD 11.4).
const METHODS = [
  { code: 'ICB', label: 'International Competitive Bidding (ICB)', family: 'RFB', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'NCB', label: 'National Competitive Bidding (NCB)', family: 'RFB', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'RFB', label: 'Request for Bids (RFB)', family: 'RFB', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'Shopping', label: 'Shopping', family: 'RFQ', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'RFQ', label: 'Request for Quotation (RFQ)', family: 'RFQ', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'Direct', label: 'Direct Procurement', family: 'Direct', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'DC', label: 'Direct Contracting (DC)', family: 'Direct', categories: ['Goods', 'Works', 'Non-Consulting Services'] },
  { code: 'UN', label: 'UN Agency Procurement', family: 'UN', categories: ['Goods', 'Works', 'Non-Consulting Services', 'Consultancy Services'] },
  { code: 'QCBS', label: 'Quality and Cost-Based Selection (QCBS)', family: 'ConsultancyFirm', categories: ['Consultancy Services'] },
  { code: 'FBS', label: 'Fixed Budget Selection (FBS)', family: 'ConsultancyFirm', categories: ['Consultancy Services'] },
  { code: 'LCS', label: 'Least Cost Selection (LCS)', family: 'ConsultancyFirm', categories: ['Consultancy Services'] },
  { code: 'CQS', label: "Selection Based on Consultants' Qualifications (CQS)", family: 'ConsultantQualification', categories: ['Consultancy Services'] },
  { code: 'INDV', label: 'Individual Consultant Selection (INDV)', family: 'IndividualConsultant', categories: ['Consultancy Services'] },
  { code: 'NPO', label: 'NPO / Bank / Procurement Agent', family: 'NpoBankAgent', categories: ['Consultancy Services'] },
];

// Shared fields appearing before the planned/actual date columns in the STEP
// procurement-plan workbook supplied by the Ministry.
const ACTIVITY_FIELDS = [
  { key: 'inProcess', label: 'In process', type: 'boolean' },
  { key: 'loanCreditNo', label: 'Loan / credit number', type: 'text', required: true },
  { key: 'component', label: 'Project component', type: 'text', required: true },
  { key: 'reviewType', label: 'Review type', type: 'select', options: ['Prior', 'Post'], required: true },
  { key: 'marketApproach', label: 'Market approach', type: 'text', required: true },
  { key: 'highSeaShRisk', label: 'High SEA/SH risk', type: 'boolean' },
  { key: 'procurementDocumentType', label: 'Procurement document type', type: 'text' },
  { key: 'processStatus', label: 'Process status', type: 'select', options: ['Planned', 'Pending Implementation', 'Under Implementation', 'Signed', 'Completed', 'Canceled', 'Terminated'], required: true },
  { key: 'activityStatus', label: 'Activity status', type: 'select', options: ['Draft', 'Cleared', 'Modified/Cleared'], required: true },
];

const METHOD_FIELDS = {
  RFB: [
    { key: 'prequalification', label: 'Prequalification required', type: 'boolean' },
    { key: 'procurementProcess', label: 'Procurement process', type: 'text' },
    { key: 'evaluationOptions', label: 'Evaluation options', type: 'text' },
  ],
  Direct: [{ key: 'evaluationOptions', label: 'Evaluation options', type: 'text' }],
  UN: [{ key: 'evaluationOptions', label: 'Evaluation options', type: 'text' }],
};

// Minimal per-category extra fields stored in procurement_activities.category_data
// (SDD 7.5 / 11.3) — basic presence/type validation, not a full schema engine.
const CATEGORY_FIELDS = {
  Goods: [
    { key: 'lotNumber', label: 'Lot number', type: 'text' },
    { key: 'qualification', label: 'Qualification requirement', type: 'text' },
    { key: 'domesticPreference', label: 'Domestic preference applies', type: 'boolean' },
    { key: 'letterOfCreditApplicable', label: 'Letter of credit applicable', type: 'boolean' },
    { key: 'deliveryTerms', label: 'Delivery terms', type: 'text' },
  ],
  Works: [
    { key: 'lotNumber', label: 'Lot number', type: 'text' },
    { key: 'qualificationType', label: 'Qualification type', type: 'text' },
    { key: 'domesticPreference', label: 'Domestic preference applies', type: 'boolean' },
    { key: 'handoverRequired', label: 'Handover required', type: 'boolean' },
    { key: 'physicalProgress', label: 'Physical progress (%)', type: 'number' },
  ],
  'Non-Consulting Services': [
    { key: 'serviceType', label: 'Service type', type: 'text' },
    { key: 'marketApproach', label: 'Market approach', type: 'text' },
    { key: 'acceptanceRequired', label: 'Acceptance required', type: 'boolean' },
  ],
  'Consultancy Services': [
    { key: 'contractType', label: 'Contract type', type: 'select', options: ['Lump Sum', 'Time Based'] },
    { key: 'firmOrIndividual', label: 'Firm or individual', type: 'select', options: ['Firm', 'Individual'] },
    { key: 'selectionMethod', label: 'Selection method detail', type: 'text' },
  ],
};

const PLAN_STATUSES = [
  'DRAFT', 'SUBMITTED_TO_DIRECTOR', 'RETURNED_FOR_CORRECTION', 'REJECTED_BY_DIRECTOR',
  'DIRECTOR_APPROVED', 'COMMITTEE_REVIEW', 'MANAGEMENT_REVIEW', 'FINALLY_APPROVED',
  'REJECTED_BY_COMMITTEE', 'REJECTED_BY_MANAGEMENT',
  'REPLANNED', 'CLOSED', 'CANCELLED',
];

const STAGE_STATUSES = ['Pending', 'InProgress', 'Completed', 'NotApplicable'];

const COMMITTEE_SIZE = 5;
const COMMITTEE_APPROVAL_THRESHOLD = 3;
// Default for SDD 20.2's open "committee rejection rule": once a majority of
// reject votes makes reaching the approval threshold impossible, stop early.
const COMMITTEE_REJECT_THRESHOLD = COMMITTEE_SIZE - COMMITTEE_APPROVAL_THRESHOLD + 1; // 3

module.exports = {
  CATEGORIES, CATEGORY_CODES, METHODS, STAGE_TEMPLATES, RFB_PREQUALIFICATION_STAGES,
  ACTIVITY_FIELDS, METHOD_FIELDS, CATEGORY_FIELDS, ACTUAL_ONLY_STAGES,
  PLAN_STATUSES, STAGE_STATUSES, COMMITTEE_SIZE, COMMITTEE_APPROVAL_THRESHOLD, COMMITTEE_REJECT_THRESHOLD,
};
