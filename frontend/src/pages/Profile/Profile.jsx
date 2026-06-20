import React, { useMemo, useState } from 'react';
import { CheckCircle, Key, Shield, User } from 'lucide-react';
import {
    Line,
    LineChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import GraphSection from '../../components/UI/GraphSection';
import { changePassword } from '../../api/profileEndpoints';
import { setRiskThresholds } from '../../api/dataEndpoints';
import { useAuth } from '../../contexts/useAuth';
import './Profile.css';

const Profile = () => {
    const { user } = useAuth();
    const [passwords, setPasswords] = useState({
        oldPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [thresholds, setThresholds] = useState({ medium: 30, high: 70 });
    const [status, setStatus] = useState({ loading: false, error: null, success: null });

    const thresholdImpact = useMemo(() => ([
        { stage: 'Low', exposure: Math.max(0, thresholds.medium - 10) },
        { stage: 'Medium', exposure: thresholds.medium },
        { stage: 'High', exposure: thresholds.high },
        { stage: 'Critical', exposure: Math.min(100, thresholds.high + 10) },
    ]), [thresholds]);

    const handleChange = (event) => {
        setPasswords((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setStatus({ loading: true, error: null, success: null });

        if (passwords.newPassword.length < 6) {
            setStatus({ loading: false, error: 'New password must be at least 6 characters long.', success: null });
            return;
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            setStatus({ loading: false, error: 'New passwords do not match.', success: null });
            return;
        }

        try {
            const response = await changePassword({
                old_password: passwords.oldPassword,
                new_password: passwords.newPassword,
            });
            setStatus({ loading: false, error: null, success: response.message || 'Password updated successfully.' });
            setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            setStatus({
                loading: false,
                error: error.response?.data?.detail || 'Failed to update password.',
                success: null,
            });
        }
    };

    const handleThresholdSave = async () => {
        try {
            await setRiskThresholds(thresholds.medium, thresholds.high);
            setStatus({ loading: false, error: null, success: 'Risk thresholds updated successfully.' });
        } catch (error) {
            setStatus({
                loading: false,
                error: error.response?.data?.detail || 'Failed to save thresholds.',
                success: null,
            });
        }
    };

    return (
        <div className="page-shell settings-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Settings</span>
                    <h1 className="page-title">Security and risk thresholds in one place.</h1>
                    <p className="page-subtitle">
                        Manage account credentials, review access identity, and tune the medium and high risk thresholds from a premium settings surface.
                    </p>
                </div>
            </header>

            {status.error ? <div className="settings-status settings-status--error">{status.error}</div> : null}
            {status.success ? <div className="settings-status settings-status--success"><CheckCircle size={16} /> {status.success}</div> : null}

            <section className="settings-top-grid">
                <div className="surface-card settings-profile-card">
                    <span className="page-eyebrow">Identity</span>
                    <div className="settings-profile-card__avatar">
                        <User size={42} />
                    </div>
                    <h2>{user?.username}</h2>
                    <div className="settings-role-pill">
                        <Shield size={14} />
                        <span>{user?.role}</span>
                    </div>
                </div>

                <div className="surface-card settings-threshold-card">
                    <span className="page-eyebrow">Risk Thresholds</span>
                    <h2>Adjust fraud sensitivity</h2>

                    <label>Medium risk threshold: {thresholds.medium}%</label>
                    <input
                        type="range"
                        min="10"
                        max="50"
                        value={thresholds.medium}
                        onChange={(event) => setThresholds((current) => ({ ...current, medium: Number(event.target.value) }))}
                    />

                    <label>High risk threshold: {thresholds.high}%</label>
                    <input
                        type="range"
                        min="51"
                        max="95"
                        value={thresholds.high}
                        onChange={(event) => setThresholds((current) => ({ ...current, high: Number(event.target.value) }))}
                    />

                    <button className="fintech-button" onClick={handleThresholdSave} type="button">Save Thresholds</button>
                </div>
            </section>

            <section className="settings-bottom-grid">
                <div className="surface-card settings-password-card">
                    <span className="page-eyebrow">Password</span>
                    <h2>Update credentials</h2>
                    <form className="settings-password-form" onSubmit={handlePasswordSubmit}>
                        <input className="fintech-input" type="password" name="oldPassword" placeholder="Current password" value={passwords.oldPassword} onChange={handleChange} />
                        <input className="fintech-input" type="password" name="newPassword" placeholder="New password" value={passwords.newPassword} onChange={handleChange} />
                        <input className="fintech-input" type="password" name="confirmPassword" placeholder="Confirm new password" value={passwords.confirmPassword} onChange={handleChange} />
                        <button className="fintech-button" disabled={status.loading} type="submit">
                            <Key size={16} />
                            {status.loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>

                <GraphSection
                    eyebrow="Impact Graph"
                    title="Threshold impact preview"
                    subtitle="A full-width settings graph showing how the current threshold choices shape the risk ladder."
                    className="settings-graph-section"
                >
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={thresholdImpact}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2fb" />
                            <XAxis dataKey="stage" tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748d', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="exposure" stroke="#533afd" strokeWidth={2} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </GraphSection>
            </section>
        </div>
    );
};

export default Profile;
