import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';

import { publishLiveStreamRow } from '../api/dataEndpoints';
import { buildMetadataFromResults } from '../utils/csvDataset';
import { useAuth } from './useAuth';

const LiveDatasetWatchContext = createContext(null);
export { LiveDatasetWatchContext };

function parseCsvFile(file) {
    return new Promise((resolve, reject) => {
        import('papaparse').then(({ default: Papa }) => {
            Papa.parse(file, {
                header: true,
                worker: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results),
                error: reject,
            });
        }).catch(reject);
    });
}

export const LiveDatasetWatchProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const handleRef = useRef(null);
    const rowCountRef = useRef(0);
    const columnsRef = useRef([]);
    const fileSignatureRef = useRef('');
    const intervalRef = useRef(null);
    const busyRef = useRef(false);

    const [watchState, setWatchState] = useState({
        active: false,
        supported: typeof window !== 'undefined' && 'showOpenFilePicker' in window,
        fileName: '',
        message: '',
        error: '',
    });
    const [datasetState, setDatasetState] = useState({
        locked: false,
        fileName: '',
        metadata: null,
    });

    const stopWatching = useCallback(() => {
        if (intervalRef.current) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        busyRef.current = false;
        setWatchState((current) => ({
            ...current,
            active: false,
        }));
    }, []);

    const clearWatchedDataset = useCallback(() => {
        stopWatching();
        handleRef.current = null;
        rowCountRef.current = 0;
        columnsRef.current = [];
        fileSignatureRef.current = '';
        setDatasetState({
            locked: false,
            fileName: '',
            metadata: null,
        });
        setWatchState((current) => ({
            ...current,
            fileName: '',
            message: '',
            error: '',
        }));
    }, [stopWatching]);

    const registerSelectedCsv = useCallback(({ fileHandle = null, rows = [], columns = [], fileName = '' }) => {
        handleRef.current = fileHandle;
        rowCountRef.current = rows.length;
        columnsRef.current = columns;
        fileSignatureRef.current = '';
        setWatchState((current) => ({
            ...current,
            fileName,
            message: fileHandle ? 'Selected CSV is ready for automatic live monitoring.' : '',
            error: '',
        }));
    }, []);

    const lockDataset = useCallback(({ fileName = '', metadata = null }) => {
        setDatasetState({
            locked: true,
            fileName,
            metadata,
        });
    }, []);

    const monitorForAppendedRows = useCallback(async () => {
        if (busyRef.current || !handleRef.current || !isAuthenticated) {
            return;
        }

        busyRef.current = true;
        try {
            const latestFile = await handleRef.current.getFile();
            const nextSignature = `${latestFile.size}:${latestFile.lastModified}`;
            if (nextSignature === fileSignatureRef.current) {
                busyRef.current = false;
                return;
            }

            const results = await parseCsvFile(latestFile);
            const nextRows = results.data || [];
            const nextColumns = results.meta.fields || [];
            const previousCount = rowCountRef.current || 0;

            fileSignatureRef.current = nextSignature;

            if (nextRows.length <= previousCount) {
                busyRef.current = false;
                return;
            }

            if (JSON.stringify(nextColumns) !== JSON.stringify(columnsRef.current || [])) {
                setWatchState((current) => ({
                    ...current,
                    error: 'Detected column changes. Auto-watch only supports appended rows on the same dataset.',
                    message: '',
                }));
                busyRef.current = false;
                return;
            }

            const appendedRows = nextRows.slice(previousCount);
            if (!appendedRows.length) {
                busyRef.current = false;
                return;
            }

            setWatchState((current) => ({
                ...current,
                error: '',
                message: `Detected ${appendedRows.length} new row(s). Running live analysis...`,
            }));

            for (const row of appendedRows) {
                await publishLiveStreamRow(row, 'file-auto-watch');
            }

            rowCountRef.current = nextRows.length;
            setDatasetState((current) => ({
                locked: current.locked,
                fileName: latestFile.name || current.fileName,
                metadata: buildMetadataFromResults(
                    results,
                    current.metadata?.ignored_columns || null,
                ),
            }));
            setWatchState((current) => ({
                ...current,
                error: '',
                message: `${appendedRows.length} new row(s) analyzed and added to Live Stream automatically.`,
            }));
        } catch (error) {
            setWatchState((current) => ({
                ...current,
                error: error?.message || 'Automatic CSV monitoring failed.',
                message: '',
            }));
        } finally {
            busyRef.current = false;
        }
    }, [isAuthenticated]);

    const startWatching = useCallback(() => {
        if (!handleRef.current) {
            setWatchState((current) => ({
                ...current,
                active: false,
                error: current.supported ? 'Choose the CSV through the secure picker to enable automatic monitoring.' : current.error,
            }));
            return;
        }

        stopWatching();
        intervalRef.current = window.setInterval(() => {
            void monitorForAppendedRows();
        }, 3000);

        setWatchState((current) => ({
            ...current,
            active: true,
            error: '',
            message: 'Automatic CSV monitoring is active across pages.',
        }));
    }, [monitorForAppendedRows, stopWatching]);

    useEffect(() => {
        if (!isAuthenticated) {
            clearWatchedDataset();
        }
    }, [clearWatchedDataset, isAuthenticated]);

    const value = {
        watchState,
        datasetState,
        registerSelectedCsv,
        lockDataset,
        startWatching,
        stopWatching,
        clearWatchedDataset,
    };

    return (
        <LiveDatasetWatchContext.Provider value={value}>
            {children}
        </LiveDatasetWatchContext.Provider>
    );
};
