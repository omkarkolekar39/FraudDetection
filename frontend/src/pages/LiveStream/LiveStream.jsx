import React, { useEffect, useState } from 'react';
import { Activity, RadioTower, Video } from 'lucide-react';

import { getLiveStreamSocketUrl, getLiveStreamStatus } from '../../api/dataEndpoints';
import RiskBadge from '../../components/UI/RiskBadge';
import './LiveStream.css';

const formatCellValue = (value) => {
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

const LiveStream = () => {
    const [streamStatus, setStreamStatus] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');

    const events = streamStatus?.recent_events || [];
    const streamColumns = streamStatus?.stream_columns?.length
        ? streamStatus.stream_columns
        : Array.from(new Set(events.flatMap((event) => Object.keys(event.row_data || {}))));

    useEffect(() => {
        let socket;
        let reconnectTimer;
        let stopped = false;

        const hydrate = async () => {
            try {
                const response = await getLiveStreamStatus();
                setStreamStatus(response);
            } catch (error) {
                console.error('Failed to load live stream status:', error);
                setStatusMessage('Live stream status is temporarily unavailable.');
            }
        };

        const connectSocket = () => {
            if (stopped) {
                return;
            }

            socket = new WebSocket(getLiveStreamSocketUrl());
            socket.onopen = () => {
                setStatusMessage('');
                socket.send('hello');
            };
            socket.onmessage = (message) => {
                try {
                    const event = JSON.parse(message.data);
                    if (event.type === 'snapshot') {
                        setStreamStatus(event.payload);
                    }
                    if (event.type === 'live_row') {
                        setStreamStatus(event.status || ((current) => ({
                            ...(current || {}),
                            recent_events: [event.payload, ...(current?.recent_events || [])],
                            displayed_rows: (current?.displayed_rows || 0) + 1,
                            total_scored_rows: (current?.total_scored_rows || 0) + 1,
                            last_message_at: event.payload?.timestamp,
                        })));
                    }
                } catch (error) {
                    console.error('Live stream websocket message failed:', error);
                }
            };
            socket.onerror = () => {
                setStatusMessage('Live stream socket is reconnecting...');
            };
            socket.onclose = () => {
                if (!stopped) {
                    reconnectTimer = window.setTimeout(connectSocket, 2000);
                }
            };
        };

        void hydrate();
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
    }, []);

    return (
        <div className="page-shell live-stream-page">
            <header className="page-header-block">
                <div className="page-header-copy">
                    <span className="page-eyebrow">Live Stream</span>
                    <h1 className="page-title">Watch new rows get scored as soon as they enter the stream.</h1>
                    <p className="page-subtitle">
                        This page shows the current live scoring lane, the watched CSV state, and every new row that is analyzed after your dataset is locked.
                    </p>
                </div>
            </header>

            {statusMessage ? <div className="live-stream-status">{statusMessage}</div> : null}

            <section className="live-stream-grid-page">
                <div className="surface-card live-stream-monitor">
                    <div className="live-stream-monitor__header">
                        <span className="page-eyebrow">Monitor</span>
                        <div className={`live-stream-pill ${streamStatus?.enabled ? 'online' : 'offline'}`}>
                            <RadioTower size={14} />
                            <span>{streamStatus?.enabled ? `Live ${String(streamStatus?.transport || 'direct').toUpperCase()}` : 'Live Offline'}</span>
                        </div>
                    </div>

                    <div className="live-stream-video">
                        <Video size={28} />
                        <strong>Stream Monitor</strong>
                        <p>
                            {streamStatus?.ready_for_scoring
                                ? 'The scoring pipeline is ready. New rows can be consumed and evaluated against the active models.'
                                : 'Upload a dataset and run analytics before the stream can score new rows.'}
                        </p>
                    </div>

                    <div className="live-stream-meta">
                        <div>
                            <span>Transport</span>
                            <strong>{String(streamStatus?.transport || 'direct').toUpperCase()}</strong>
                        </div>
                        <div>
                            <span>Active Upload</span>
                            <strong>{streamStatus?.active_upload_id || '-'}</strong>
                        </div>
                        <div>
                            <span>Active Run</span>
                            <strong>{streamStatus?.active_run_id || '-'}</strong>
                        </div>
                        <div>
                            <span>Displayed Rows</span>
                            <strong>{streamStatus?.displayed_rows || 0}/{streamStatus?.total_scored_rows || 0}</strong>
                        </div>
                        <div>
                            <span>CSV Watcher</span>
                            <strong>{streamStatus?.csv_watch?.enabled ? 'Watching' : 'Inactive'}</strong>
                        </div>
                    </div>
                    {streamStatus?.csv_watch?.path ? (
                        <div className="live-stream-watch-path">
                            <span>Watched CSV Path</span>
                            <strong>{streamStatus.csv_watch.path}</strong>
                        </div>
                    ) : null}
                </div>

                <div className="surface-card live-stream-events">
                    <div className="live-stream-events__header">
                        <span className="page-eyebrow">Recent Results</span>
                        <div className="live-stream-events__title">
                            <Activity size={16} />
                            <h2>Incoming rows</h2>
                        </div>
                    </div>

                    {events.length ? (
                        <div className="live-stream-events__list">
                            {events.slice(0, 6).map((event) => (
                                <article key={`${event.record_id}-${event.timestamp}`} className="live-stream-events__item">
                                    <div className="live-stream-events__item-top">
                                        <strong>{event.record_id}</strong>
                                        <RiskBadge value={event.category} />
                                    </div>
                                    <p>
                                        Risk {Number(event.risk_score || 0).toFixed(2)} · AE {Number(event.ae_error || 0).toFixed(4)} · IF {Number(event.if_score || 0).toFixed(4)}
                                    </p>
                                    <span>{event.source} · {event.timestamp}</span>
                                    <div className="live-stream-events__mini-grid">
                                        {Object.entries(event.row_data || {}).slice(0, 4).map(([key, value]) => (
                                            <div key={key}>
                                                <span>{key}</span>
                                                <strong>{formatCellValue(value)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="live-stream-events__empty">
                            No streamed rows have been scored yet.
                        </div>
                    )}
                </div>
            </section>

            <section className="surface-card live-stream-table-card">
                <div className="live-stream-events__header">
                    <span className="page-eyebrow">Complete Stream Data</span>
                    <strong>{events.length ? `${events.length} scored rows loaded` : 'Waiting for data'}</strong>
                </div>

                {events.length ? (
                    <div className="live-stream-table-wrap">
                        <table className="live-stream-table">
                            <thead>
                                <tr>
                                    <th>Record</th>
                                    <th>Risk</th>
                                    <th>Risk Score</th>
                                    <th>AE Error</th>
                                    <th>IF Score</th>
                                    <th>Source</th>
                                    {streamColumns.map((column) => (
                                        <th key={column}>{column}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((event) => (
                                    <tr key={`${event.record_id}-${event.timestamp}-row`}>
                                        <td>{event.record_id}</td>
                                        <td><RiskBadge value={event.category} /></td>
                                        <td>{Number(event.risk_score || 0).toFixed(2)}</td>
                                        <td>{Number(event.ae_error || 0).toFixed(6)}</td>
                                        <td>{Number(event.if_score || 0).toFixed(6)}</td>
                                        <td>{event.source || '-'}</td>
                                        {streamColumns.map((column) => (
                                            <td key={`${event.record_id}-${column}`}>
                                                {formatCellValue(event.row_data?.[column])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="live-stream-events__empty">
                        Upload and analyze a CSV, then append a row to the watched file or send a live row to populate this table.
                    </div>
                )}
            </section>
        </div>
    );
};

export default LiveStream;
