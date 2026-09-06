import si from 'systeminformation';

const HOST_FS_ROOT = process.env.HOST_FS_ROOT ?? '/hostfs';

export async function getCurrentHardwareStats() {
  const [load, memory] = await Promise.all([
    si.currentLoad(),
    si.mem(),
  ]);

  return {
    cpu: {
      loadPercent: Number(load.currentLoad.toFixed(1)),
    },
    memory: {
      totalBytes: memory.total,
      usedBytes: memory.used,
      freeBytes: memory.free,
      usedPercent: Number(((memory.used / memory.total) * 100).toFixed(1)),
    },
    timestamp: new Date().toISOString(),
  };
}

export async function getHostDiskStats() {
  const fileSystems = await si.fsSize(HOST_FS_ROOT);

  return fileSystems.map((fileSystem) => ({
    fs: fileSystem.fs,
    type: fileSystem.type,
    sizeBytes: fileSystem.size,
    usedBytes: fileSystem.used,
    availableBytes: fileSystem.available,
    usePercent: fileSystem.use,
    mountPoint: fileSystem.mount,
    readOnly: !fileSystem.rw,
  }));
}