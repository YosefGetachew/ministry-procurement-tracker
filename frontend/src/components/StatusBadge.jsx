import React from 'react';
import { PLAN_STATUS_META } from '../constants';

export default function StatusBadge({ status }) {
  const meta = PLAN_STATUS_META[status] || { label: status, tone: 'neutral' };
  return <span className={`pt-badge-tone pt-badge-tone-${meta.tone}`}>{meta.label}</span>;
}
