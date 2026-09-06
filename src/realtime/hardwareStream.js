import { getCurrentHardwareStats } from '../services/systemStats.js';

export function createHardwareStatsStream(io, options = {}) {
  const intervalMs = options.intervalMs ?? 2000;

  const emitStats = async () => {
    try {
      const stats = await getCurrentHardwareStats();
      io.emit('hardware:stats', stats);
    } catch (error) {
      io.emit('hardware:error', {
        message: 'Failed to collect hardware stats',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void emitStats();
  const timer = setInterval(emitStats, intervalMs);

  io.on('connection', async (socket) => {
    try {
      socket.emit('hardware:stats', await getCurrentHardwareStats());
    } catch (error) {
      socket.emit('hardware:error', {
        message: 'Failed to collect hardware stats',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return () => {
    clearInterval(timer);
  };
}