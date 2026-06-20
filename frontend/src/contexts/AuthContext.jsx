import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthSession, persistAuthSession, readAuthSession } from '../utils/authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    /**
     * Effect: Initial Session Check
     * Checks if the operator has valid clearance keys in storage on refresh.
     */
    useEffect(() => {
        const initAuth = () => {
            const session = readAuthSession();

            if (session) {
                setUser({ username: session.username, role: session.role });
                setIsAuthenticated(true);
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    /**
     * login: Updates React State
     * Called by the auth page immediately after loginOperator success.
     */
    const login = (userData) => {
        persistAuthSession(userData);
        setUser({ username: userData.username, role: userData.role });
        setIsAuthenticated(true);
    };

    /**
     * logout: Purges Security Clearance
     */
    const logout = () => {
        clearAuthSession();
        setUser(null);
        setIsAuthenticated(false);
        navigate('/login');
    };

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export { AuthContext };
