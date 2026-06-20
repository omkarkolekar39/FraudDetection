import { useContext } from 'react';
import { LiveDatasetWatchContext } from './LiveDatasetWatchContext';

export function useLiveDatasetWatch() {
    return useContext(LiveDatasetWatchContext);
}
