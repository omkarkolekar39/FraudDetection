export const navigationItems = [
    { label: 'Dashboard', iconKey: 'dashboard', to: '/dashboard', roles: ['Admin', 'Analyst', 'Viewer'] },
    { label: 'Data Ingestion', iconKey: 'ingestion', to: '/ingestion', roles: ['Admin', 'Analyst', 'Viewer'] },
    { label: 'Analytics', iconKey: 'analytics', to: '/analytics', roles: ['Admin', 'Analyst', 'Viewer'] },
    { label: 'Transactions', iconKey: 'directory', to: '/directory', roles: ['Admin', 'Analyst', 'Viewer'] },
    { label: 'Transaction Details', iconKey: 'customer', to: '/customer-360', roles: ['Admin', 'Analyst'] },
    { label: 'Explainability', iconKey: 'xai', to: '/xai', roles: ['Admin', 'Analyst', 'Viewer'] },
    { label: 'Live Stream', iconKey: 'stream', to: '/live-stream', roles: ['Admin', 'Analyst'] },
    { label: 'Audits', iconKey: 'audits', to: '/audits', roles: ['Admin'] },
    { label: 'Alerts', iconKey: 'alerts', to: '/actions', roles: ['Admin'] },
    { label: 'Case Management', iconKey: 'cases', to: '/audit-logs', roles: ['Admin'] },
    { label: 'Settings', iconKey: 'settings', to: '/profile', roles: ['Admin', 'Analyst', 'Viewer'] },
];

export const resolveHomeRoute = (role) => {
    if (role === 'Admin') return '/admin-dashboard';
    if (role === 'Analyst') return '/analyst-dashboard';
    return '/viewer-dashboard';
};
