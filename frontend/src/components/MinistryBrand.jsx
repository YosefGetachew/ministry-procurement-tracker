import React from 'react';
import ministryLogo from '../assets/ministry-logo.png';

export function MinistryLogo({ compact = false }) {
  return <span className={`pt-ministry-logo ${compact ? 'compact' : ''}`}><img src={ministryLogo} alt="Ministry of Agriculture" /></span>;
}

export default function MinistryBrand({ login = false }) {
  return <div className={`pt-brand ${login ? 'pt-brand-login' : ''}`}>
    <MinistryLogo />
    <div><strong>MoA PTS</strong><small>Procurement Tracking System</small></div>
  </div>;
}
