import http from 'node:http';

import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from 'socket.io';

import { getHostDiskStats } from './services/systemStats.js';
import { createHardwareStatsStream } from './realtime/hardwareStream.js';

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/storage/disk', async (_request, response) => {
  try {
    const disks = await getHostDiskStats();
    response.json({
      mountRoot: process.env.HOST_FS_ROOT ?? '/hostfs',
      disks,
    });
  } catch (error) {
    response.status(500).json({
      message: 'Failed to read host disk space',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const clientDistPath = join(process.cwd(), 'dist', 'client');

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api/')) {
      next();
      return;
    }

    if (!existsSync(join(clientDistPath, 'index.html'))) {
      next();
      return;
    }

    response.sendFile(join(clientDistPath, 'index.html'));
  });
}

io.on('connection', (socket) => {
  socket.emit('server:ready', {
    message: 'Connected to Ghost Dash hardware monitor',
  });
});

createHardwareStatsStream(io, {
  intervalMs: 2000,
});

const port = process.env.PORT ?? 3000;

httpServer.listen(port, () => {
  console.log(`Ghost Dash hardware monitor listening on port ${port}`);
});