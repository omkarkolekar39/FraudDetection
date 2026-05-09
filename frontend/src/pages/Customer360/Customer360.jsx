import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import RiskBadge from '../../components/UI/RiskBadge';
import GraphSection from '../../components/UI/GraphSection';
import ShapWaterfallChart from '../../components/Charts/ShapWaterfallChart';
import { getCustomer360, getXaiShap, simulateCustomer360 } from '../../api/mlEndpoints';
import './Customer360.css';
import { exportCustomer360Report } from '../../utils/pdfExport';
import { useRef } from 'react';

const Customer360 = () => {
    const location = useLocation();
    const customerRef = useRef();
    const [searchId, setSearchId] = useState('');
    const [customerData, setCustomerData] = useState(null);
    const [baseShapData, setBaseShapData] = useState([]);
    const [displayedShapData, setDisplayedShapData] = useState([]);
    const [simulationDraft, setSimulationDraft] = useState({});
    const [simulationResult, setSimulationResult] = useState(null);
    const [featureFilter, setFeatureFilter] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [error, setError] = useState(null);

    const activeProfile = simulationResult?.Simulated_Profile || customerData;
    const baseProfile = simulationResult?.Base_Profile || customerData;

    const editableEntries = useMemo(
        () => Object.entries(simulationDraft).filter(([column]) =>
            column.toLowerCase().includes(featureFilter.toLowerCase()),
        ),
        [featureFilter, simulationDraft],
    );

    async function lookupRecord(targetId) {
        if (!targetId.trim() || targetId === 'undefined') return;

        setIsLoading(true);
        setError(null);
        setSimulationResult(null);

        try {
            const [customerResponse, shapResponse] = await Promise.all([
                getCustomer360(targetId.trim()),
                getXaiShap(targetId.trim()),
            ]);

            const nextCustomer = customerResponse.data;
            const nextShap = Array.isArray(shapResponse?.explanations) ? shapResponse.explanations : [];

            setCustomerData(nextCustomer);
            setBaseShapData(nextShap);
            setDisplayedShapData(nextShap);
            setSimulationDraft(nextCustomer.Simulation_Features || {});
            setFeatureFilter('');
        } catch (requestError) {
            console.error('Investigation failure:', requestError);
            setError(`Record ${targetId} could not be reconstructed from the current analytics buffer.`);
            setCustomerData(null);
            setBaseShapData([]);
            setDisplayedShapData([]);
            setSimulationDraft({});
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const prefill = location.state?.prefillRecordId;
        if (!prefill) return undefined;

        const timeoutId = window.setTimeout(() => {
            setSearchId(prefill);
            void lookupRecord(prefill);
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, [location.state]);

    const handleSearch = async (event) => {
        event.preventDefault();
        await lookupRecord(searchId);
    };

    const handleSimulation = async () => {
        if (!customerData?.Account_ID) return;

        setIsSimulating(true);
        try {
            const response = await simulateCustomer360(customerData.Account_ID, simulationDraft);
            setSimulationResult(response.data);
            setDisplayedShapData(Array.isArray(response.explanations) ? response.explanations : []);
        } catch (requestError) {
            setError(requestError.response?.data?.detail || requestError.message || 'Unable to simulate a new risk score.');
        } finally {
            setIsSimulating(false);
        }
    };

    const resetSimulation = () => {
        if (!customerData) return;
        setSimulationDraft(customerData.Simulation_Features || {});
        setSimulationResult(null);
        setDisplayedShapData(baseShapData);
    };

    const updateSimulationField = (column, value) => {
        setSimulationDraft((previous) => ({
            ...previous,
            [column]: value,
        }));
    };

    const handleDownloadReport = async () => {
        if (!customerData) return;
        await exportCustomer360Report({
            customerRef: customerRef.current,
            customerData,
        });
    };

    return (
        <div className="page-shell transaction-details-page" ref={customerRef}>
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Transaction Details</span>
                    <h1 className="page-title">Investigate a single record in depth.</h1>
                    <p className="page-subtitle">
                        Search by serial record ID such as RECORD 1 or by an original dataset ID, then inspect the stored profile, adjust features, and review the SHAP explanation in the dominant dark analytics section below.
                    </p>
                </div>

                <form className="transaction-search" onSubmit={handleSearch}>
                    <div className="transaction-search__field">
                        <Search size={16} />
                        <input
                            className="fintech-input"
                            type="text"
                            placeholder="Enter RECORD 1 or a dataset ID..."
                            value={searchId}
                            onChange={(event) => setSearchId(event.target.value)}
                        />
                    </div>
                    <button className="fintech-button" disabled={isLoading || !searchId.trim()} type="submit">
                        {isLoading ? 'Loading...' : 'Analyze'}
                    </button>
                </form>
            </header>

            {error ? <div className="transaction-details-error">{error}</div> : null}

            {customerData ? (
                <>
                    <button className="fintech-button" style={{marginBottom: 16}} onClick={handleDownloadReport} type="button">
                        Download Report
                    </button>
                    <section className="transaction-details-top">
                        <div className="surface-card transaction-summary-card">
                            <span className="page-eyebrow">Record Overview</span>
                            <h2>{customerData.Account_ID}</h2>
                            <p>This record is fully reconstructed from the in-memory fraud analytics buffer.</p>
                            <RiskBadge value={activeProfile?.Risk_Category} />
                        </div>

                        <div className="surface-card transaction-score-card">
                            <span className="page-eyebrow">Risk Score</span>
                            <div className="transaction-score-card__value">{Number(activeProfile?.Risk_Score || 0).toFixed(1)}</div>
                            <p>Score on a 0 to 100 risk scale.</p>
                        </div>

                        <div className="surface-card transaction-metrics-card">
                            <div className="transaction-metric">
                                <span>Base Risk</span>
                                <strong>{Number(baseProfile?.Risk_Score || 0).toFixed(2)}%</strong>
                            </div>
                            <div className="transaction-metric">
                                <span>IF Score</span>
                                <strong>{Number(activeProfile?.IF_Score || 0).toFixed(4)}</strong>
                            </div>
                            <div className="transaction-metric">
                                <span>AE Loss</span>
                                <strong>{Number(activeProfile?.AE_Loss || 0).toFixed(4)}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="transaction-details-mid">
                        <div className="surface-card simulation-panel">
                            <div className="simulation-panel__header">
                                <div>
                                    <span className="page-eyebrow">What-if Inputs</span>
                                    <h2>Modify analyzable fields</h2>
                                </div>
                                <div className="simulation-panel__actions">
                                    <button className="fintech-button-secondary" onClick={resetSimulation} type="button">Reset</button>
                                    <button className="fintech-button" disabled={isSimulating} onClick={handleSimulation} type="button">
                                        {isSimulating ? 'Simulating...' : 'Analyze New Risk'}
                                    </button>
                                </div>
                            </div>

                            <input
                                className="fintech-input"
                                type="text"
                                placeholder="Filter analyzable columns..."
                                value={featureFilter}
                                onChange={(event) => setFeatureFilter(event.target.value)}
                            />

                            <div className="simulation-table-wrap">
                                <table className="simulation-table">
                                    <thead>
                                        <tr>
                                            <th>Column</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {editableEntries.map(([column, value]) => (
                                            <tr key={column}>
                                                <td>{column}</td>
                                                <td>
                                                    <input
                                                        className="fintech-input"
                                                        type="number"
                                                        step="any"
                                                        value={value}
                                                        onChange={(event) => updateSimulationField(column, event.target.value)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="surface-card record-table-panel">
                            <span className="page-eyebrow">Full Transaction Info</span>
                            <h2>Stored record attributes</h2>
                            <div className="record-table-wrap">
                                <table className="record-table">
                                    <tbody>
                                        {Object.entries(simulationResult?.Simulated_Profile?.Features || customerData.Features || {}).map(([key, value]) => (
                                            <tr key={key}>
                                                <td>{key.replace(/_/g, ' ')}</td>
                                                <td>{typeof value === 'number' ? value.toFixed(4) : String(value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <GraphSection
                        dark
                        eyebrow="SHAP Explanation"
                        title="Dominant local explanation for this transaction"
                        subtitle="This dark analytics section stays visually primary so the record-level reasoning remains the clearest part of the detail view."
                    >
                        <ShapWaterfallChart data={displayedShapData} />
                    </GraphSection>
                </>
            ) : (
                <div className="surface-card transaction-empty-state">
                    Search for a serial ID like RECORD 1 to open the transaction detail workspace.
                </div>
            )}
        </div>
    );
};

export default Customer360;
