import React, { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import {
    UploadCloud, RefreshCcw, CheckCircle, Play,
    Database, List, AlertCircle, ShieldCheck, RadioTower, SendHorizontal, Activity,
} from 'lucide-react';

import { getLiveStreamSocketUrl, getLiveStreamStatus, publishLiveStreamRow, uploadCsvData, setRiskThresholds, watchCsvFilePath } from '../../api/dataEndpoints';
import { runMlPipeline } from '../../api/mlEndpoints';
import { useLiveDatasetWatch } from '../../contexts/useLiveDatasetWatch';
import { useAuth } from '../../contexts/useAuth';
import { buildMetadataFromResults } from '../../utils/csvDataset';

import './DataIngestion.css';

function parseCsvResults(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            worker: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
        });
    });
}

const formatStreamValue = (value) => {
    if (value === null || value === undefined || value === '') {
        return '-';
    }

    if (typeof value === 'number') {
        return Number.isInteger(value) ? value : value.toFixed(4);
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
};

const DataIngestion = () => {
    const fileInputRef = useRef(null);
    const { user } = useAuth();
    const canViewLiveStream = user?.role !== 'Viewer';

    const [file, setFile] = useState(null);
    const [metadata, setMetadata] = useState(null);
    const [uploadStatus, setUploadStatus] = useState({ loading: false, success: false, error: null });
    const [thresholds, setThresholds] = useState({ mid: 30, high: 70 });
    const [pipelineStatus, setPipelineStatus] = useState({ loading: false, success: false, error: null });
    const [showPopup, setShowPopup] = useState(false);
    const [streamPayload, setStreamPayload] = useState('{}');
    const [streamStatus, setStreamStatus] = useState(null);
    const [streamPublishStatus, setStreamPublishStatus] = useState({ loading: false, message: '', error: null });
    const [watchPath, setWatchPath] = useState('');
    const {
        watchState,
        datasetState,
        registerSelectedCsv,
        lockDataset,
        startWatching,
        clearWatchedDataset,
    } = useLiveDatasetWatch();
    const autoWatchSupported = canViewLiveStream && watchState?.supported;
    const autoWatchActive = canViewLiveStream && watchState?.active;

    useEffect(() => {
        if (!canViewLiveStream) {
            return undefined;
        }

        let socket;
        let reconnectTimer;
        let stopped = false;

        const hydrateStatus = async () => {
            try {
                const data = await getLiveStreamStatus();
                setStreamStatus(data);
            } catch (error) {
                console.error('Live stream status fetch failed:', error);
            }
        };

        const connectSocket = () => {
            if (stopped) {
                return;
            }

            socket = new WebSocket(getLiveStreamSocketUrl());
            socket.onopen = () => {
                socket.send('hello');
            };
            socket.onmessage = (message) => {
                try {
                    const event = JSON.parse(message.data);
                    if (event.type === 'snapshot') {
                        setStreamStatus(event.payload);
                    }
                    if (event.type === 'live_row' && event.status) {
                        setStreamStatus(event.status);
                    }
                } catch (error) {
                    console.error('Live stream websocket message failed:', error);
                }
            };
            socket.onclose = () => {
                if (!stopped) {
                    reconnectTimer = window.setTimeout(connectSocket, 2000);
                }
            };
        };

        void hydrateStatus();
        connectSocket();

        return () => {
            stopped = true;
            if (reconnectTimer) {
                window.clearTimeout(reconnectTimer);
            }
            if (socket) {
                socket.close();
            }
        };
    }, [canViewLiveStream]);

    useEffect(() => {
        if (!datasetState?.locked) {
            return;
        }

        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) {
                return;
            }

            setUploadStatus((current) => ({ ...current, success: true }));
            setPipelineStatus((current) => ({ ...current, success: true }));
            if (datasetState.metadata) {
                setMetadata(datasetState.metadata);
                const templateRow = datasetState.metadata.preview_data?.[0]
                    || Object.fromEntries((datasetState.metadata.column_names || []).map((column) => [column, '']));
                setStreamPayload(JSON.stringify(templateRow, null, 2));
            }
        });

        return () => {
            cancelled = true;
        };
    }, [datasetState]);

    const loadSelectedFile = async (selectedFile, fileHandle = null) => {
        setFile(selectedFile);
        setUploadStatus({ loading: false, success: false, error: null });

        const rawResults = await parseCsvResults(selectedFile);
        const nextMetadata = buildMetadataFromResults(rawResults);
        setMetadata(nextMetadata);
        const templateRow = nextMetadata.preview_data?.[0]
            || Object.fromEntries(nextMetadata.column_names.map((column) => [column, '']));
        setStreamPayload(JSON.stringify(templateRow, null, 2));
        registerSelectedCsv({
            fileHandle: canViewLiveStream ? fileHandle : null,
            rows: rawResults.data || [],
            columns: rawResults.meta.fields || [],
            fileName: selectedFile.name,
        });
    };

    const handleChooseCsvSource = async () => {
        if (!autoWatchSupported) {
            fileInputRef.current?.click();
            return;
        }

        try {
            const [fileHandle] = await window.showOpenFilePicker({
                multiple: false,
                types: [
                    {
                        description: 'CSV dataset',
                        accept: { 'text/csv': ['.csv'] },
                    },
                ],
            });
            const selectedFile = await fileHandle.getFile();
            await loadSelectedFile(selectedFile, fileHandle);
        } catch (error) {
            if (error?.name !== 'AbortError') {
                console.error('CSV picker failed:', error);
            }
        }
    };

    const handleFileChange = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) {
            return;
        }

        await loadSelectedFile(selectedFile);
    };

    const handleSyncUpdatedCsv = async (event) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) {
            return;
        }

        setFile(selectedFile);
        setUploadStatus({ loading: true, success: true, error: null });
        setPipelineStatus({ loading: true, success: false, error: null });
        setStreamPublishStatus({ loading: false, message: '', error: null });

        try {
            await setRiskThresholds(thresholds.mid, thresholds.high);
            const response = await uploadCsvData(selectedFile, metadata?.ignored_columns || []);
            const rawResults = await parseCsvResults(selectedFile);
            const nextMetadata = buildMetadataFromResults(
                rawResults,
                response.ignored_columns || metadata?.ignored_columns || [],
            );
            setMetadata(nextMetadata);
            registerSelectedCsv({
                fileHandle: null,
                rows: rawResults.data || [],
                columns: rawResults.meta.fields || [],
                fileName: selectedFile.name,
            });
            lockDataset({
                fileName: selectedFile.name,
                metadata: nextMetadata,
            });
            setStreamStatus(response.live_stream || await getLiveStreamStatus());
            setUploadStatus({ loading: false, success: true, error: null });
            setPipelineStatus({ loading: false, success: true, error: null });
            setStreamPublishStatus({
                loading: false,
                message: response.incremental
                    ? `${response.new_rows?.length || 0} new row(s) scored and added to Live Stream. Search RECORD ${response.total_records} in Customer 360.`
                    : 'CSV was re-analyzed as a refreshed dataset because it was not a simple append.',
                error: null,
            });
        } catch (error) {
            setUploadStatus({
                loading: false,
                success: true,
                error: error.response?.data?.detail || error.message || 'Failed to sync updated CSV.',
            });
            setPipelineStatus({
                loading: false,
                success: false,
                error: error.response?.data?.detail || 'Updated CSV sync failed.',
            });
        } finally {
            event.target.value = '';
        }
    };

    const moveColumn = (columnName, destination) => {
        setMetadata((current) => {
            if (!current) {
                return current;
            }

            const ignored = new Set(current.ignored_columns);
            const analyzed = new Set(current.analyzed_columns);
            if (destination === 'ignored') {
                analyzed.delete(columnName);
                ignored.add(columnName);
            } else {
                ignored.delete(columnName);
                analyzed.add(columnName);
            }

            return {
                ...current,
                ignored_columns: current.column_names.filter((column) => ignored.has(column)),
                analyzed_columns: current.column_names.filter((column) => analyzed.has(column)),
            };
        });
    };

    const handleLockAndValidate = async () => {
        if (!file) {
            return;
        }

        setUploadStatus({ loading: true, success: false, error: null });
        setPipelineStatus({ loading: true, success: false, error: null });
        try {
            await setRiskThresholds(thresholds.mid, thresholds.high);
            const response = await uploadCsvData(file, metadata?.ignored_columns || []);
            if (response.status === 'success') {
                lockDataset({
                    fileName: file?.name || watchState?.fileName || '',
                    metadata: response.metadata || metadata,
                });
                if (response.metadata) {
                    setMetadata(response.metadata);
                }
                setUploadStatus({ loading: false, success: true, error: null });
                setPipelineStatus({ loading: false, success: true, error: null });
                setShowPopup(true);
                setStreamStatus(response.live_stream || await getLiveStreamStatus());
                if (canViewLiveStream) {
                    startWatching();
                }
                window.setTimeout(() => setShowPopup(false), 1600);
            }
        } catch (error) {
            setUploadStatus({
                loading: false,
                success: false,
                error: error.response?.data?.detail || error.message || 'Connection Error: Failed to uplink and analyze dataset.',
            });
            setPipelineStatus({
                loading: false,
                success: false,
                error: error.response?.data?.detail || 'Neural Engine Protocol Failure.',
            });
        }
    };

    const handleRunPipeline = async () => {
        setPipelineStatus({ loading: true, success: false, error: null });
        try {
            await setRiskThresholds(thresholds.mid, thresholds.high);
            const response = await runMlPipeline();

            if (response.status === 'success') {
                setPipelineStatus({ loading: false, success: true, error: null });
                setShowPopup(true);
                const status = await getLiveStreamStatus();
                setStreamStatus(status);
                window.setTimeout(() => setShowPopup(false), 1600);
            }
        } catch {
            setPipelineStatus({
                loading: false,
                success: false,
                error: 'Neural Engine Protocol Failure.',
            });
        }
    };

    const handleReset = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        clearWatchedDataset();
        setFile(null);
        setMetadata(null);
        setUploadStatus({ loading: false, success: false, error: null });
        setPipelineStatus({ loading: false, success: false, error: null });
        setShowPopup(false);
        setStreamPublishStatus({ loading: false, message: '', error: null });
        setWatchPath('');
    };

    const handlePublishLiveRow = async () => {
        setStreamPublishStatus({ loading: true, message: '', error: null });
        try {
            const parsedRow = JSON.parse(streamPayload);
            const response = await publishLiveStreamRow(parsedRow);
            setStreamPublishStatus({
                loading: false,
                message: `Row ${response.event?.record_id || ''} analyzed and sent to Live Stream.`,
                error: null,
            });
            const status = await getLiveStreamStatus();
            setStreamStatus(status);
        } catch (error) {
            setStreamPublishStatus({
                loading: false,
                message: '',
                error: error.response?.data?.detail || error.message || 'Failed to publish live row.',
            });
        }
    };

    const handleWatchPath = async () => {
        if (!watchPath.trim()) {
            return;
        }

        setStreamPublishStatus({ loading: true, message: '', error: null });
        try {
            const response = await watchCsvFilePath(watchPath.trim());
            setStreamStatus(response.live_stream);
            setStreamPublishStatus({
                loading: false,
                message: `Watching ${response.path}. Append rows to this file and they will stream automatically.`,
                error: null,
            });
        } catch (error) {
            setStreamPublishStatus({
                loading: false,
                message: '',
                error: error.response?.data?.detail || error.message || 'Failed to watch this CSV path.',
            });
        }
    };

    return (
        <div className="ingestion-3d-layout">
            {showPopup && (
                <div className="modal-overlay">
                    <div className="glass-modal animate-pop">
                        <ShieldCheck size={64} color="#52C41A" className="mb-20" />
                        <h2 className="modal-title">ANALYTICS COMPLETE</h2>
                        <p className="modal-subtitle">Neural scores synchronized. Live monitoring stays active here.</p>
                    </div>
                </div>
            )}

            <header className="ingestion-header">
                <div className="title-group">
                    <h2 className="nav-section-title">DATA INGESTION HUB</h2>
                </div>
                <button className="btn-reset-3d" onClick={handleReset}>
                    <RefreshCcw size={14} /> RESET SYSTEM
                </button>
            </header>

            <div className="ingestion-grid">
                <div className={`card-3d-ingestion ${uploadStatus.success ? 'locked-card' : ''}`}>
                    <h3 className="card-heading-3d">1. INGEST & LOCK</h3>

                    {!uploadStatus.success ? (
                        <div className="upload-inner-3d">
                            <UploadCloud size={48} color="#2563eb" />
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden id="csv-input" accept=".csv" />
                            <button type="button" className="btn-secondary-3d" onClick={handleChooseCsvSource}>
                                CHOOSE CSV SOURCE
                            </button>

                            {file && <span className="file-chip-3d">{file.name}</span>}
                            {autoWatchSupported ? <p className="auto-watch-hint">This browser can keep watching the same selected CSV after upload.</p> : null}
                            {canViewLiveStream && watchState?.message ? <p className="live-stream-success">{watchState.message}</p> : null}
                            {canViewLiveStream && watchState?.error ? <p className="error-msg-3d"><AlertCircle size={14} /> {watchState.error}</p> : null}
                            {uploadStatus.error && <p className="error-msg-3d"><AlertCircle size={14} /> {uploadStatus.error}</p>}

                            <button className="btn-primary-3d" onClick={handleLockAndValidate} disabled={!file || uploadStatus.loading}>
                                {uploadStatus.loading ? 'ANALYZING DATASET...' : 'UPLOAD & ANALYZE'}
                            </button>
                        </div>
                    ) : (
                        <div className="upload-inner-3d animate-pop">
                            <CheckCircle size={56} color="#ffffff" />
                            <p className="locked-success-text">DATASET ANALYZED</p>
                            <input type="file" onChange={handleSyncUpdatedCsv} hidden id="csv-update-input" accept=".csv" />
                            <label htmlFor="csv-update-input" className="btn-secondary-3d">
                                {uploadStatus.loading ? 'SYNCING UPDATED CSV...' : 'SYNC UPDATED CSV'}
                            </label>
                            <p className="incremental-sync-hint">
                                {!canViewLiveStream
                                    ? 'Upload the updated CSV here to refresh the dataset analysis.'
                                    : autoWatchActive
                                    ? 'Auto-watch is active. Save the same CSV after adding rows and they will be analyzed automatically.'
                                    : 'Add rows to the same CSV, then upload it here only if auto-watch is not available. Only newly appended rows are scored.'}
                            </p>
                        </div>
                    )}
                </div>

                <div className={`card-3d-ingestion ${uploadStatus.loading ? 'disabled-card' : ''}`}>
                    <h3 className="card-heading-3d">2. RISK CALIBRATION</h3>

                    <div className="slider-box-yellow">
                        <div className="slider-info-3d">
                            <label>MEDIUM RISK THRESHOLD</label>
                            <span>{thresholds.mid}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="50"
                            value={thresholds.mid}
                            onChange={(event) => setThresholds({ ...thresholds, mid: event.target.value })}
                            disabled={uploadStatus.loading}
                        />
                    </div>

                    <div className="slider-box-red">
                        <div className="slider-info-3d">
                            <label>HIGH RISK THRESHOLD</label>
                            <span>{thresholds.high}%</span>
                        </div>
                        <input
                            type="range"
                            min="51"
                            max="95"
                            value={thresholds.high}
                            onChange={(event) => setThresholds({ ...thresholds, high: event.target.value })}
                            disabled={uploadStatus.loading}
                        />
                    </div>

                    <button className="btn-primary-3d" onClick={handleRunPipeline} disabled={!uploadStatus.success || pipelineStatus.loading}>
                        <Play size={16} fill="white" />
                        {pipelineStatus.loading ? 'ANALYZING...' : 'RE-RUN WITH THRESHOLDS'}
                    </button>
                </div>
            </div>

            {metadata && (
                <div className="animate-slideUp">
                    <div className="meta-stats-bar">
                        <div className="meta-pill big-pill">
                            <div className="pill-label-group">
                                <Database size={24} color="#2563eb" />
                                <span>TOTAL RECORDS</span>
                            </div>
                            <strong>{metadata.total_records.toLocaleString()}</strong>
                        </div>

                        <div className="meta-pill big-pill">
                            <div className="pill-label-group">
                                <List size={24} color="#2563eb" />
                                <span>COLUMNS DETECTED</span>
                            </div>
                            <strong>{metadata.total_columns}</strong>
                        </div>
                    </div>

                    <div className="meta-stats-bar">
                        <div className="meta-pill big-pill">
                            <div className="pill-label-group">
                                <List size={24} color="#2563eb" />
                                <span>ANALYZED COLUMNS</span>
                            </div>
                            <strong>{metadata.analyzed_columns.length}</strong>
                        </div>

                        <div className="meta-pill big-pill">
                            <div className="pill-label-group">
                                <AlertCircle size={24} color="#d97706" />
                                <span>IGNORED COLUMNS</span>
                            </div>
                            <strong>{metadata.ignored_columns.length}</strong>
                        </div>
                    </div>

                    <div className="card-3d-ingestion full-width-3d">
                        <h3 className="card-heading-3d">SCHEMA FIELDS</h3>
                        <div className="tag-grid-wrap">
                            {metadata.column_names.map((name) => (
                                <span key={name} className={`tag-3d ${metadata.ignored_columns.includes(name) ? 'tag-ignored' : 'tag-analyzed'}`}>
                                    {name}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="card-3d-ingestion full-width-3d">
                        <div className="column-control-header">
                            <div>
                                <h3 className="card-heading-3d">ML COLUMN CONTROL</h3>
                                <p className="column-control-subtitle">
                                    Add any column to ignored and it will be excluded when analytics runs.
                                </p>
                            </div>
                        </div>

                        <div className="column-control-grid">
                            <div className="column-list-card">
                                <div className="column-list-head">
                                    <span>Analyzed Columns</span>
                                    <strong>{metadata.analyzed_columns.length}</strong>
                                </div>
                                <div className="column-list-body">
                                    {metadata.analyzed_columns.map((name) => (
                                        <button
                                            key={name}
                                            className="column-toggle-chip"
                                            onClick={() => moveColumn(name, 'ignored')}
                                            type="button"
                                            disabled={uploadStatus.loading || uploadStatus.success}
                                        >
                                            <span>{name}</span>
                                            <span className="column-toggle-action">Ignore</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="column-list-card column-list-card--ignored">
                                <div className="column-list-head">
                                    <span>Ignored Columns</span>
                                    <strong>{metadata.ignored_columns.length}</strong>
                                </div>
                                <div className="column-list-body">
                                    {metadata.ignored_columns.length > 0 ? metadata.ignored_columns.map((name) => (
                                        <button
                                            key={name}
                                            className="column-toggle-chip column-toggle-chip--ignored"
                                            onClick={() => moveColumn(name, 'analyzed')}
                                            type="button"
                                            disabled={uploadStatus.loading || uploadStatus.success}
                                        >
                                            <span>{name}</span>
                                            <span className="column-toggle-action">
                                                Analyze
                                            </span>
                                        </button>
                                    )) : (
                                        <p className="column-list-empty">No ignored columns selected.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {canViewLiveStream ? (
                    <div className="card-3d-ingestion full-width-3d">
                        <div className="live-stream-header">
                            <div>
                                <h3 className="card-heading-3d">3. LIVE STREAM</h3>
                                <p className="live-stream-subtitle">
                                    New rows can be scored directly without reprocessing the whole dataset. If the selected CSV stays under watch, saving an appended row triggers live analysis automatically.
                                </p>
                            </div>
                            <div className={`live-stream-badge ${streamStatus?.enabled ? 'online' : 'offline'}`}>
                                <RadioTower size={14} />
                                <span>{streamStatus?.enabled ? `Live ${String(streamStatus?.transport || 'direct').toUpperCase()}` : 'Live Offline'}</span>
                            </div>
                        </div>

                        <div className="live-stream-meta-grid">
                            <div className="live-stream-meta-card">
                                <span>Scoring</span>
                                <strong>{streamStatus?.ready_for_scoring ? 'Ready' : 'Upload & analyze first'}</strong>
                            </div>
                            <div className="live-stream-meta-card">
                                <span>Active Upload</span>
                                <strong>{streamStatus?.active_upload_id || '-'}</strong>
                            </div>
                            <div className="live-stream-meta-card">
                                <span>Auto Watch</span>
                                <strong>{autoWatchActive ? 'Watching selected CSV' : 'Manual sync / path watch'}</strong>
                            </div>
                        </div>

                        <div className="watch-path-panel">
                            <div>
                                <label className="live-stream-label">Optional local CSV path to watch</label>
                                <input
                                    className="fintech-input"
                                    type="text"
                                    placeholder="Example: E:\\data\\fraud.csv"
                                    value={watchPath}
                                    onChange={(event) => setWatchPath(event.target.value)}
                                />
                                <p>
                                    Browser uploads cannot always expose the original file path. Paste a local/server path here only if you want backend file watching instead of browser-side auto-watch.
                                </p>
                            </div>
                            <button className="btn-primary-3d" type="button" onClick={handleWatchPath} disabled={!watchPath.trim() || streamPublishStatus.loading}>
                                WATCH THIS CSV
                            </button>
                        </div>

                        <div className="live-stream-grid">
                            <div className="live-stream-editor">
                                <label className="live-stream-label">Incoming row JSON</label>
                                <textarea
                                    className="live-stream-textarea"
                                    value={streamPayload}
                                    onChange={(event) => setStreamPayload(event.target.value)}
                                    spellCheck={false}
                                />
                                {streamPublishStatus.error ? <p className="error-msg-3d"><AlertCircle size={14} /> {streamPublishStatus.error}</p> : null}
                                {streamPublishStatus.message ? <p className="live-stream-success">{streamPublishStatus.message}</p> : null}
                                <button
                                    className="btn-primary-3d"
                                    type="button"
                                    onClick={handlePublishLiveRow}
                                    disabled={!uploadStatus.success || !pipelineStatus.success || streamPublishStatus.loading}
                                >
                                    <SendHorizontal size={16} />
                                    {streamPublishStatus.loading ? 'ANALYZING LIVE ROW...' : 'SEND ONE LIVE ROW'}
                                </button>
                            </div>

                            <div className="live-stream-feed">
                                <div className="live-stream-feed-header">
                                    <Activity size={16} />
                                    <span>Recent Streamed Results</span>
                                </div>

                                {streamStatus?.recent_events?.length ? (
                                    <div className="live-stream-event-list">
                                        {streamStatus.recent_events.map((event) => (
                                            <div key={`${event.record_id}-${event.timestamp}`} className={`live-stream-event-card ${event.category}`}>
                                                <div className="live-stream-event-top">
                                                    <strong>{event.record_id}</strong>
                                                    <span className="live-stream-event-pill">{String(event.category || '').toUpperCase()}</span>
                                                </div>
                                                <p>Risk score {Number(event.risk_score || 0).toFixed(2)} · AE {Number(event.ae_error || 0).toFixed(4)} · IF {Number(event.if_score || 0).toFixed(4)}</p>
                                                <small>{event.source} · {event.timestamp}</small>
                                                <div className="live-stream-row-preview">
                                                    {Object.entries(event.row_data || {}).slice(0, 6).map(([key, value]) => (
                                                        <span key={key}>
                                                            <strong>{key}</strong>
                                                            {formatStreamValue(value)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="live-stream-empty">
                                        No streamed rows scored yet. Publish one row after upload analysis completes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    ) : null}

                    <div className="card-3d-ingestion full-width-3d">
                        <h3 className="card-heading-3d">DATASET PREVIEW</h3>
                        <div className="table-viewport">
                            <table className="table-3d">
                                <thead>
                                    <tr>{metadata.column_names.map((column) => <th key={column}>{column}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {metadata.preview_data.map((row, index) => (
                                        <tr key={index}>
                                            {metadata.column_names.map((key) => <td key={key}>{row[key]}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataIngestion;
