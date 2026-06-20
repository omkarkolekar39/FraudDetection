import React from 'react';
import './RiskBadge.css';

const normalizeRisk = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('high')) return { tone: 'high', label: 'High Risk' };
    if (normalized.includes('med')) return { tone: 'medium', label: 'Medium Risk' };
    return { tone: 'low', label: 'Low Risk' };
};

const RiskBadge = ({ value, className = '' }) => {
    const { tone, label } = normalizeRisk(value);

    return (
        <span className={`risk-badge risk-badge--${tone} ${className}`.trim()}>
            {label}
        </span>
    );
};

export default RiskBadge;
