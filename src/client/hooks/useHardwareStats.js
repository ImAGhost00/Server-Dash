import { useEffect, useState } from 'react';

import { createClientSocket } from '../socket.js';

const initialStats = {
  cpu: {
    loadPercent: 0,
  },
  memory: {
    totalBytes: 0,
    usedBytes: 0,
    freeBytes: 0,
    usedPercent: 0,
  },
  timestamp: null,
};

export function useHardwareStats() {
  const [stats, setStats] = useState(initialStats);
  const [connectionState, setConnectionState] = useState('connecting');
  const [error, setError] = useState(null);

  useEffect(() => {
    const socket = createClientSocket();

    socket.on('connect', () => {
      setConnectionState('connected');
      setError(null);
    });

    socket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    socket.on('hardware:stats', (nextStats) => {
      setStats(nextStats);
    });

    socket.on('hardware:error', (nextError) => {
      setError(nextError);
    });

    return () => {
      socket.close();
    };
  }, []);

  return {
    stats,
    connectionState,
    error,
  };
}