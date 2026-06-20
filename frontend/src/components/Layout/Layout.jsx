import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    Activity,
    BarChart3,
    Bell,
    BellOff,
    BrainCircuit,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Database,
    FileClock,
    FolderSearch,
    LayoutDashboard,
    LogOut,
    RadioTower,
    ScrollText,
    Settings,
    ShieldAlert,
    Trash2,
    UploadCloud,
    User,
    Users,
    Zap,
} from 'lucide-react';

import brandMark from '../../assets/logo.svg';
import { API_ORIGIN } from '../../config/runtimeConfig';
import { useAuth } from '../../contexts/useAuth';
import { useNotifications } from '../../contexts/useNotifications';
import { navigationItems } from '../../services/navigation';
import './Layout.css';

const iconMap = {
    dashboard: LayoutDashboard,
    ingestion: UploadCloud,
    analytics: BarChart3,
    directory: FolderSearch,
    customer: Users,
    xai: BrainCircuit,
    stream: RadioTower,
    audits: FileClock,
    alerts: Zap,
    cases: ScrollText,
    settings: Settings,
};

const Layout = ({ children }) => {
    const { isAuthenticated, user, logout } = useAuth();
    const {
        notifications,
        unreadCount,
        markAllAsRead,
        markOneAsRead,
        removeNotification,
        clearRead,
    } = useNotifications();

    const navigate = useNavigate();
    const location = useLocation();
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isApiOnline, setIsApiOnline] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return undefined;

        const checkHealth = async () => {
            try {
                const response = await fetch(`${API_ORIGIN}/`);
                setIsApiOnline(response.ok);
            } catch {
                setIsApiOnline(false);
            }
        };

        void checkHealth();
        const intervalId = window.setInterval(checkHealth, 10000);

        return () => window.clearInterval(intervalId);
    }, [isAuthenticated]);

    useEffect(() => {
        const closeMenus = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }

            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        };

        document.addEventListener('mousedown', closeMenus);
        return () => document.removeEventListener('mousedown', closeMenus);
    }, []);

    if (!isAuthenticated) {
        return <div className="public-layout">{children}</div>;
    }

    const visibleItems = navigationItems.filter((navItem) => !user?.role || navItem.roles.includes(user.role));

    return (
        <div className={`app-shell ${isSidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
            <div className="app-shell__body">
                <aside className="app-sidebar">
                    <button className="app-sidebar__brand" type="button" onClick={() => navigate('/dashboard')}>
                        <span className="app-sidebar__logo">
                            <img src={brandMark} alt="Fraud detection logo" />
                        </span>
                        {!isSidebarCollapsed ? (
                            <span className="app-sidebar__brand-text">
                                <strong>Fraud Guard</strong>
                                <small>Risk workspace</small>
                            </span>
                        ) : null}
                    </button>

                    <nav className="app-sidebar__nav" aria-label="Primary navigation">
                        {visibleItems.map((navItem) => {
                            const Icon = iconMap[navItem.iconKey] || Database;
                            const isActive = location.pathname === navItem.to ||
                                (navItem.to !== '/dashboard' && location.pathname.startsWith(navItem.to));

                            return (
                                <NavLink
                                    key={navItem.to}
                                    to={navItem.to}
                                    className={`app-sidebar__link ${isActive ? 'is-active' : ''}`}
                                    title={isSidebarCollapsed ? navItem.label : undefined}
                                >
                                    <Icon size={18} />
                                    {!isSidebarCollapsed ? <span>{navItem.label}</span> : null}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <button
                        className="app-sidebar__collapse"
                        type="button"
                        onClick={() => setIsSidebarCollapsed((value) => !value)}
                        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                        {!isSidebarCollapsed ? <span>Collapse</span> : null}
                    </button>
                </aside>

                <div className="app-shell__content">
                    <header className="app-header">
                        <div>
                            <span className="app-header__eyebrow">Financial Fraud Detection</span>
                            <h1>Investigation workspace</h1>
                        </div>

                        <div className="app-header__actions">
                            <div className={`app-health ${isApiOnline ? 'app-health--online' : 'app-health--offline'}`}>
                                <Activity size={14} />
                                <span>{isApiOnline ? 'API online' : 'API offline'}</span>
                            </div>

                            <div className="app-popover" ref={notificationRef}>
                                <button
                                    className="app-icon-button"
                                    type="button"
                                    onClick={() => setShowNotifications((value) => !value)}
                                    aria-label="Open notifications"
                                >
                                    <Bell size={18} />
                                    {unreadCount > 0 ? <span className="app-icon-button__dot" /> : null}
                                </button>

                                {showNotifications ? (
                                    <div className="app-menu app-menu--notifications">
                                        <div className="app-menu__header">
                                            <strong>Notifications</strong>
                                            <div>
                                                <button type="button" onClick={markAllAsRead}>Mark read</button>
                                                <button type="button" onClick={clearRead}>Clear read</button>
                                            </div>
                                        </div>

                                        <div className="app-notification-list">
                                            {notifications?.length ? (
                                                notifications.slice(0, 6).map((notification) => (
                                                    <article
                                                        key={notification.id}
                                                        className={`app-notification ${!notification.is_read ? 'is-unread' : ''}`}
                                                    >
                                                        <ShieldAlert size={17} />
                                                        <div>
                                                            <p>{notification.message}</p>
                                                            <small>{notification.time || 'Just now'}</small>
                                                        </div>
                                                        <div className="app-notification__actions">
                                                            {!notification.is_read ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => markOneAsRead(notification.id)}
                                                                    aria-label="Mark notification as read"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                            ) : (
                                                                <span><BellOff size={13} /> Read</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeNotification(notification.id)}
                                                                aria-label="Delete notification"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </article>
                                                ))
                                            ) : (
                                                <div className="app-empty-menu">
                                                    <CheckCircle size={26} />
                                                    <strong>No new alerts</strong>
                                                    <span>The workspace is quiet for now.</span>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            className="app-menu__footer"
                                            type="button"
                                            onClick={() => {
                                                navigate('/actions');
                                                setShowNotifications(false);
                                            }}
                                        >
                                            Open alerts
                                        </button>
                                    </div>
                                ) : null}
                            </div>

                            <div className="app-popover" ref={profileRef}>
                                <button
                                    className="app-profile-button"
                                    type="button"
                                    onClick={() => setShowProfileMenu((value) => !value)}
                                >
                                    <span>
                                        <strong>{user?.username || 'operator'}</strong>
                                        <small>{user?.role || 'Viewer'} access</small>
                                    </span>
                                    <span className="app-profile-button__avatar">
                                        <User size={16} />
                                    </span>
                                </button>

                                {showProfileMenu ? (
                                    <div className="app-menu app-menu--profile">
                                        <button type="button" onClick={() => navigate('/profile')}>
                                            <Settings size={16} />
                                            Settings
                                        </button>
                                        <button className="app-menu__danger" type="button" onClick={logout}>
                                            <LogOut size={16} />
                                            Sign out
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </header>

                    <main className="app-shell__main">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Layout;
