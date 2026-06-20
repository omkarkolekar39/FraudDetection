// FraudDetectAI/frontend/src/components/UI/StatCard.jsx

import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }) => {
    return (
        <div className="stat-card">
            <div className="stat-card-header">
                <div>
                    <h4 className="stat-title">{title}</h4>
                    {subtitle && <p className="stat-subtitle">{subtitle}</p>}
                </div>
                <div className={`stat-icon-wrapper ${colorClass}`}>
                    {Icon && <Icon size={20} />}
                </div>
            </div>
            <div className="stat-card-body">
                <h2 className="stat-value">{value}</h2>
            </div>
        </div>
    );
};

export default StatCard;
