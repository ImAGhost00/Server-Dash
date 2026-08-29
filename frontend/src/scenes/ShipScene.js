const PALETTE = {
  bg: 0x0b0414,
  panelFill: 0x1a1028,
  panelStroke: 0x9b7fc4,
  titleBarFill: 0x2e1d42,
  gridLine: 0xb388ff,
  accent: 0xb388ff,
  accentBright: 0xd4bbff,
  gaugeTrack: 0x2a1a45,
  good: 0x7ef7d6,
  warning: 0xf9c74f,
  danger: 0xff6b6b,
};

function formatStorageValue(gb) {
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(2)} TB`;
  }
  return `${gb.toFixed(1)} GB`;
}

class ShipScene extends Phaser.Scene {
  constructor() {
    super('ShipScene');

    // Same-origin by default so it works through the Nginx /ws proxy on the real server;
    // ?backend=host:port lets you point at a different backend during local dev only.
    const backendOverride = new URLSearchParams(window.location.search).get('backend');
    const socketHost = backendOverride || window.location.host;
    const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    this.wsUrl = `${socketProtocol}://${socketHost}/ws`;
    this.roomRegistry = [
      { id: 'engine', name: 'Engine Room', x: 0.2, y: 0.46, width: 0.28, height: 0.5 },
      { id: 'storage', name: 'Storage Bay', x: 0.64, y: 0.46, width: 0.56, height: 0.5 },
    ];
    this.metrics = {
      cpu_percent: 0,
      ram_percent: 0,
      disk_percent: 0,
      disk_used_gb: 0,
      disk_total_gb: 0,
      disk_free_gb: 0,
      media_percent: 0,
      media_used_gb: 0,
      media_total_gb: 0,
      media_free_gb: 0,
      media_available: false,
    };
    this.socket = null;
    this.storageOpen = false;
    this.mediaOpen = false;
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.createStationFrame();
    this.createRoomModules();
    this.connectSocket();
  }

  connectSocket() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'metrics' && payload.data) {
          this.metrics = payload.data;
          this.updateRoomTelemetry();
        }
      } catch (error) {
        console.error('Invalid websocket payload', error);
      }
    });

    this.socket.addEventListener('close', () => {
      setTimeout(() => this.connectSocket(), 2000);
    });
  }

  createStationFrame() {
    const { width, height } = this.scale;

    this.add.text(width * 0.5, height * 0.08, 'STATION GRID', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    const grid = this.add.graphics();
    grid.lineStyle(1, PALETTE.gridLine, 0.12);

    for (let x = 0; x <= 12; x += 1) {
      const px = width * (x / 12);
      grid.lineBetween(px, height * 0.16, px, height * 0.86);
    }

    for (let y = 0; y <= 8; y += 1) {
      const py = height * (y / 8);
      grid.lineBetween(width * 0.08, py, width * 0.92, py);
    }
  }

  createRoomModules() {
    this.roomMap = new Map();

    this.roomRegistry.forEach((config) => {
      const room = this.createModuleRoom(config);
      this.roomMap.set(config.id, room);

      room.label = this.add.text(room.x, room.y - room.height / 2 - 26, config.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f3ebff',
        backgroundColor: 'rgba(15, 10, 22, 0.85)',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setVisible(false);

      if (config.id === 'engine') {
        room.background.setInteractive({ useHandCursor: true });
        room.background.on('pointerover', () => {
          room.label.setVisible(true);
          room.background.setStrokeStyle(2, PALETTE.accentBright, 1);
        });
        room.background.on('pointerout', () => {
          room.label.setVisible(false);
          room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
        });

        room.coreGlow = this.add.circle(room.x, room.y - 90, 48, PALETTE.accent, 0.18);
        room.core = this.add.circle(room.x, room.y - 90, 26, PALETTE.accent, 0.9);
        room.core.setStrokeStyle(2, PALETTE.accentBright, 1);

        room.cpuLabel = this.add.text(room.x - 82, room.y + 20, 'CPU 0%', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#d4bbff',
        }).setOrigin(0.5);

        room.ramLabel = this.add.text(room.x + 82, room.y + 20, 'RAM 0%', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#d4bbff',
        }).setOrigin(0.5);

        room.cpuGauge = this.add.rectangle(room.x - 82, room.y + 46, 120, 10, PALETTE.gaugeTrack, 1)
          .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
        room.cpuGaugeFill = this.add.rectangle(room.x - 142, room.y + 46, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

        room.ramGauge = this.add.rectangle(room.x + 82, room.y + 46, 120, 10, PALETTE.gaugeTrack, 1)
          .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
        room.ramGaugeFill = this.add.rectangle(room.x + 22, room.y + 46, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

        room.pulse = this.tweens.add({
          targets: [room.coreGlow],
          scale: { from: 1, to: 1.7 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      if (config.id === 'storage') {
        this.createStorageBay(room);
      }
    });

    this.createStorageWindow();
    this.createMediaWindow();
  }

  createStorageBay(room) {
    const leftX = room.x - room.width / 4;
    const rightX = room.x + room.width / 4;

    room.divider = this.add.rectangle(room.x, room.y, 2, room.height * 0.84, PALETTE.panelStroke, 0.6);

    room.diskHeader = this.add.text(leftX, room.y - room.height / 2 + 32, 'DISK STORAGE', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f3ebff',
    }).setOrigin(0.5);

    room.diskUsedText = this.add.text(leftX, room.y - 34, 'USED   0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskTotalText = this.add.text(leftX, room.y, 'TOTAL  0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskFreeText = this.add.text(leftX, room.y + 34, 'FREE   0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskStatus = this.add.text(leftX, room.y + room.height / 2 - 26, 'CLICK TO INSPECT', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#7ef7d6',
    }).setOrigin(0.5);

    room.mediaHeader = this.add.text(rightX, room.y - room.height / 2 + 32, 'MEDIA POOL', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f3ebff',
    }).setOrigin(0.5);

    room.mediaUsedText = this.add.text(rightX, room.y - 34, 'USED   0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaTotalText = this.add.text(rightX, room.y, 'TOTAL  0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaFreeText = this.add.text(rightX, room.y + 34, 'FREE   0 GB', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaStatus = this.add.text(rightX, room.y + room.height / 2 - 26, 'CLICK TO INSPECT', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#7ef7d6',
    }).setOrigin(0.5);

    const zoneWidth = room.width / 2;
    const hoverHandlers = () => ({
      pointerover: () => {
        room.label.setVisible(true);
        room.background.setStrokeStyle(2, PALETTE.accentBright, 1);
      },
      pointerout: () => {
        room.label.setVisible(false);
        room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
      },
    });

    room.diskZone = this.add.rectangle(leftX, room.y, zoneWidth, room.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    const diskHover = hoverHandlers();
    room.diskZone.on('pointerover', diskHover.pointerover);
    room.diskZone.on('pointerout', diskHover.pointerout);
    room.diskZone.on('pointerdown', () => this.toggleStorageWindow(room));

    room.mediaZone = this.add.rectangle(rightX, room.y, zoneWidth, room.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    const mediaHover = hoverHandlers();
    room.mediaZone.on('pointerover', mediaHover.pointerover);
    room.mediaZone.on('pointerout', mediaHover.pointerout);
    room.mediaZone.on('pointerdown', () => this.toggleMediaWindow(room));
  }

  createModuleRoom(roomConfig) {
    const { width, height } = this.scale;
    const roomX = width * roomConfig.x;
    const roomY = height * roomConfig.y;
    const roomWidth = width * roomConfig.width;
    const roomHeight = height * roomConfig.height;

    const room = this.add.rectangle(roomX, roomY, roomWidth, roomHeight, PALETTE.panelFill, 0.94);
    room.setStrokeStyle(2, PALETTE.panelStroke, 0.9);

    return {
      id: roomConfig.id,
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
      background: room,
    };
  }

  createStorageWindow() {
    const { width, height } = this.scale;

    this.storageWindow = this.add.container(width * 0.5, height * 0.52);
    this.storageWindow.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, 420, 380, 0x120b1b, 0.96);
    backdrop.setStrokeStyle(2, PALETTE.accent, 0.8);

    const header = this.add.text(0, -165, 'DRIVE HEALTH', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f3ebff',
    }).setOrigin(0.5);

    const closeButton = this.add.text(190, -165, 'X', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff6b6b',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => this.closeStorageWindow(this.roomMap.get('storage')));

    const healthBarBg = this.add.rectangle(0, -115, 320, 24, PALETTE.gaugeTrack, 1)
      .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
    const healthBarFill = this.add.rectangle(-160, -115, 320, 22, PALETTE.gaugeTrack, 1).setOrigin(0, 0.5);
    const healthLabel = this.add.text(0, -115, 'CHECKING...', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#0b0414',
    }).setOrigin(0.5);

    const driveLabel = this.add.text(0, -75, '/ (root)', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#bfa9db',
    }).setOrigin(0.5);

    const usedText = this.add.text(0, -35, 'Used: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    const totalText = this.add.text(0, -3, 'Total: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    const freeText = this.add.text(0, 29, 'Free: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    const detailText = this.add.text(0, 68, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#bfa9db',
      align: 'center',
      wordWrap: { width: 360 },
    }).setOrigin(0.5);

    const hintText = this.add.text(0, 158, 'click the room again to close', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#bfa9db',
    }).setOrigin(0.5);

    this.storageWindow.add([
      backdrop, header, closeButton, healthBarBg, healthBarFill, healthLabel,
      driveLabel, usedText, totalText, freeText, detailText, hintText,
    ]);
    this.storageUsedText = usedText;
    this.storageTotalText = totalText;
    this.storageFreeText = freeText;
    this.storageHealthBarFill = healthBarFill;
    this.storageHealthLabel = healthLabel;
    this.storageHealthDetail = detailText;
  }

  async loadDriveHealth() {
    this.storageHealthLabel.setText('CHECKING...');
    this.storageHealthBarFill.fillColor = PALETTE.gaugeTrack;
    this.storageHealthDetail.setText('');

    try {
      const response = await fetch('/drive/health');
      const data = await response.json();

      if (data.status === 'PASSED') {
        this.storageHealthBarFill.fillColor = PALETTE.good;
        this.storageHealthLabel.setText('HEALTHY (SMART PASSED)');
      } else if (data.status === 'FAILED') {
        this.storageHealthBarFill.fillColor = PALETTE.danger;
        this.storageHealthLabel.setText('FAILING (SMART FAILED)');
      } else {
        this.storageHealthBarFill.fillColor = PALETTE.warning;
        this.storageHealthLabel.setText('UNKNOWN');
      }

      this.storageHealthDetail.setText(data.detail || '');
    } catch (error) {
      this.storageHealthBarFill.fillColor = PALETTE.warning;
      this.storageHealthLabel.setText('UNKNOWN');
      this.storageHealthDetail.setText('Could not reach health endpoint.');
      console.error('Drive health check failed', error);
    }
  }

  openStorageWindow(room) {
    this.storageOpen = true;
    this.storageWindow.setVisible(true);
    room.background.setFillStyle(0x26163a, 0.98);
    room.background.setStrokeStyle(2, PALETTE.good, 0.9);
    this.loadDriveHealth();
  }

  closeStorageWindow(room) {
    this.storageOpen = false;
    this.storageWindow.setVisible(false);
    if (!this.mediaOpen) {
      room.background.setFillStyle(PALETTE.panelFill, 0.94);
      room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
    }
  }

  toggleStorageWindow(room) {
    if (this.storageOpen) {
      this.closeStorageWindow(room);
      return;
    }

    if (this.mediaOpen) {
      this.closeMediaWindow(room);
    }
    this.openStorageWindow(room);
  }

  createMediaWindow() {
    const { width, height } = this.scale;
    const winX = width * 0.5;
    const winY = height * 0.52;

    this.mediaWindow = this.add.container(winX, winY);
    this.mediaWindow.setVisible(false);

    const backdrop = this.add.rectangle(0, 0, 460, 380, 0x120b1b, 0.96);
    backdrop.setStrokeStyle(2, PALETTE.accent, 0.8);

    const header = this.add.text(0, -170, 'MEDIA POOL BREAKDOWN', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f3ebff',
    }).setOrigin(0.5);

    const closeButton = this.add.text(210, -170, 'X', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff6b6b',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeButton.on('pointerdown', () => this.closeMediaWindow(this.roomMap.get('storage')));

    const summaryText = this.add.text(0, -128, 'Used: 0 GB\nTotal: 0 GB  Free: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#d4bbff',
      align: 'center',
      lineSpacing: 6,
    }).setOrigin(0.5);

    const listLayout = { x: -200, y: -85, width: 400, height: 210 };
    this.mediaListLayout = listLayout;

    const listBorder = this.add.rectangle(
      listLayout.x + listLayout.width / 2,
      listLayout.y + listLayout.height / 2,
      listLayout.width,
      listLayout.height,
      0x000000,
      0,
    ).setStrokeStyle(1, PALETTE.panelStroke, 0.5);

    this.mediaListContainer = this.add.container(listLayout.x, listLayout.y);

    const maskShape = this.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      winX + listLayout.x,
      winY + listLayout.y,
      listLayout.width,
      listLayout.height,
    );
    this.mediaListContainer.setMask(maskShape.createGeometryMask());

    const scrollZone = this.add.rectangle(
      listLayout.x + listLayout.width / 2,
      listLayout.y + listLayout.height / 2,
      listLayout.width,
      listLayout.height,
      0xffffff,
      0,
    ).setInteractive();
    scrollZone.on('wheel', (pointer, dx, dy) => {
      this.mediaScrollOffset = Phaser.Math.Clamp(
        (this.mediaScrollOffset || 0) - dy * 0.5,
        this.mediaScrollMin || 0,
        0,
      );
      this.mediaListContainer.y = listLayout.y + this.mediaScrollOffset;
    });

    const hintText = this.add.text(0, 165, 'scroll to browse - click the room again to close', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#bfa9db',
    }).setOrigin(0.5);

    this.mediaWindow.add([
      backdrop, header, closeButton, summaryText, listBorder, scrollZone, this.mediaListContainer, hintText,
    ]);
    this.mediaSummaryText = summaryText;
    this.mediaScrollOffset = 0;
    this.mediaScrollMin = 0;
  }

  openMediaWindow(room) {
    this.mediaOpen = true;
    this.mediaWindow.setVisible(true);
    room.background.setFillStyle(0x26163a, 0.98);
    room.background.setStrokeStyle(2, PALETTE.good, 0.9);
    this.loadMediaBreakdown();
  }

  closeMediaWindow(room) {
    this.mediaOpen = false;
    this.mediaWindow.setVisible(false);
    if (!this.storageOpen) {
      room.background.setFillStyle(PALETTE.panelFill, 0.94);
      room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
    }
  }

  toggleMediaWindow(room) {
    if (this.mediaOpen) {
      this.closeMediaWindow(room);
      return;
    }

    if (this.storageOpen) {
      this.closeStorageWindow(room);
    }
    this.openMediaWindow(room);
  }

  async loadMediaBreakdown() {
    this.mediaListContainer.removeAll(true);
    this.mediaScrollOffset = 0;
    this.mediaListContainer.y = this.mediaListLayout.y;

    const loadingText = this.add.text(0, 0, 'Loading categories...', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e6d9ff',
    });
    this.mediaListContainer.add(loadingText);

    try {
      const response = await fetch('/mediapool/breakdown');
      const data = await response.json();
      this.mediaListContainer.removeAll(true);

      if (!data.available || !data.categories || data.categories.length === 0) {
        const message = this.add.text(0, 0, 'Media pool not mounted.\nSet MEDIA_POOL_PATH in docker-compose.yml.', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e6d9ff',
        });
        this.mediaListContainer.add(message);
        this.mediaScrollMin = 0;
        return;
      }

      const sorted = [...data.categories].sort((a, b) => b.used_gb - a.used_gb);
      const rowHeight = 24;

      sorted.forEach((category, index) => {
        const row = this.add.text(
          0,
          index * rowHeight,
          `${category.name.padEnd(18, ' ')} ${formatStorageValue(category.used_gb)}`,
          {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#e6d9ff',
          },
        );
        this.mediaListContainer.add(row);
      });

      const contentHeight = sorted.length * rowHeight;
      this.mediaScrollMin = Math.min(0, this.mediaListLayout.height - contentHeight);
    } catch (error) {
      this.mediaListContainer.removeAll(true);
      const message = this.add.text(0, 0, 'Could not load breakdown.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#e6d9ff',
      });
      this.mediaListContainer.add(message);
      this.mediaScrollMin = 0;
      console.error('Media pool breakdown failed', error);
    }
  }

  updateRoomTelemetry() {
    const cpu = Math.max(0, Math.min(100, this.metrics.cpu_percent || 0));
    const ram = Math.max(0, Math.min(100, this.metrics.ram_percent || 0));
    const diskUsed = Number(this.metrics.disk_used_gb || 0);
    const diskTotal = Number(this.metrics.disk_total_gb || 0);
    const diskFree = Number(this.metrics.disk_free_gb || 0);
    const mediaUsed = Number(this.metrics.media_used_gb || 0);
    const mediaTotal = Number(this.metrics.media_total_gb || 0);
    const mediaFree = Number(this.metrics.media_free_gb || 0);
    const mediaAvailable = Boolean(this.metrics.media_available);
    const warning = cpu > 80;

    const engineRoom = this.roomMap.get('engine');
    engineRoom.cpuLabel.setText(`CPU ${cpu.toFixed(1)}%`);
    engineRoom.ramLabel.setText(`RAM ${ram.toFixed(1)}%`);
    engineRoom.cpuGaugeFill.width = 120 * (cpu / 100);
    engineRoom.ramGaugeFill.width = 120 * (ram / 100);
    engineRoom.cpuGaugeFill.fillColor = warning ? PALETTE.warning : PALETTE.accent;
    engineRoom.ramGaugeFill.fillColor = ram > 80 ? PALETTE.danger : PALETTE.accent;
    engineRoom.background.setFillStyle(warning ? 0x3a2015 : PALETTE.panelFill, 0.94);
    engineRoom.background.setStrokeStyle(2, warning ? PALETTE.warning : PALETTE.panelStroke, 0.9);
    engineRoom.coreGlow.setFillStyle(warning ? PALETTE.danger : PALETTE.accent, 0.2);
    engineRoom.core.setFillStyle(warning ? PALETTE.warning : PALETTE.accent, 0.95);

    const pulseFactor = 1 + (cpu / 100) * 1.8;
    const newDuration = Math.max(350, 1200 / pulseFactor);
    engineRoom.pulse.stop();
    engineRoom.pulse = this.tweens.add({
      targets: [engineRoom.coreGlow],
      scale: { from: 1, to: 1.7 },
      duration: newDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const storageRoom = this.roomMap.get('storage');
    storageRoom.diskUsedText.setText(`USED   ${formatStorageValue(diskUsed)}`);
    storageRoom.diskTotalText.setText(`TOTAL  ${formatStorageValue(diskTotal)}`);
    storageRoom.diskFreeText.setText(`FREE   ${formatStorageValue(diskFree)}`);
    storageRoom.diskStatus.setText('CLICK TO INSPECT');
    storageRoom.diskStatus.setColor('#7ef7d6');

    if (mediaAvailable) {
      storageRoom.mediaUsedText.setText(`USED   ${formatStorageValue(mediaUsed)}`);
      storageRoom.mediaTotalText.setText(`TOTAL  ${formatStorageValue(mediaTotal)}`);
      storageRoom.mediaFreeText.setText(`FREE   ${formatStorageValue(mediaFree)}`);
      storageRoom.mediaStatus.setText('CLICK TO INSPECT');
      storageRoom.mediaStatus.setColor('#7ef7d6');
    } else {
      storageRoom.mediaUsedText.setText('USED   N/A');
      storageRoom.mediaTotalText.setText('TOTAL  N/A');
      storageRoom.mediaFreeText.setText('FREE   N/A');
      storageRoom.mediaStatus.setText('NOT MOUNTED');
      storageRoom.mediaStatus.setColor('#ff6b6b');
    }

    this.storageUsedText.setText(`Used: ${formatStorageValue(diskUsed)}`);
    this.storageTotalText.setText(`Total: ${formatStorageValue(diskTotal)}`);
    this.storageFreeText.setText(`Free: ${formatStorageValue(diskFree)}`);

    this.mediaSummaryText.setText(mediaAvailable
      ? `Used: ${formatStorageValue(mediaUsed)}\nTotal: ${formatStorageValue(mediaTotal)}  Free: ${formatStorageValue(mediaFree)}`
      : 'Media pool volume not mounted');
  }
}

export default ShipScene;
