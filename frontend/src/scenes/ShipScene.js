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
      { id: 'engine', name: 'Engine Room', x: 0.18, y: 0.45, width: 0.28, height: 0.48 },
      { id: 'storage', name: 'Storage Room', x: 0.56, y: 0.45, width: 0.26, height: 0.48 },
    ];
    this.metrics = {
      cpu_percent: 0,
      ram_percent: 0,
      disk_percent: 0,
      disk_used_gb: 0,
      disk_free_gb: 0,
    };
    this.socket = null;
    this.storageOpen = false;
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
      letterSpacing: '0.24em',
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
        letterSpacing: '0.12em',
        backgroundColor: 'rgba(15, 10, 22, 0.85)',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setVisible(false);

      room.background.setInteractive({ useHandCursor: true });
      room.background.on('pointerover', () => {
        room.label.setVisible(true);
        room.background.setStrokeStyle(2, PALETTE.accentBright, 1);
      });
      room.background.on('pointerout', () => {
        room.label.setVisible(false);
        room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
      });

      if (config.id === 'engine') {
        room.coreGlow = this.add.circle(room.x, room.y - 80, 48, PALETTE.accent, 0.18);
        room.core = this.add.circle(room.x, room.y - 80, 26, PALETTE.accent, 0.9);
        room.core.setStrokeStyle(2, PALETTE.accentBright, 1);

        room.cpuLabel = this.add.text(room.x - 82, room.y + 10, 'CPU 0%', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#d4bbff',
        }).setOrigin(0.5);

        room.ramLabel = this.add.text(room.x + 82, room.y + 10, 'RAM 0%', {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: '#d4bbff',
        }).setOrigin(0.5);

        room.cpuGauge = this.add.rectangle(room.x - 82, room.y + 36, 120, 10, PALETTE.gaugeTrack, 1)
          .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
        room.cpuGaugeFill = this.add.rectangle(room.x - 142, room.y + 36, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

        room.ramGauge = this.add.rectangle(room.x + 82, room.y + 36, 120, 10, PALETTE.gaugeTrack, 1)
          .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
        room.ramGaugeFill = this.add.rectangle(room.x + 22, room.y + 36, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

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
        room.usedLabel = this.add.text(room.x - 58, room.y - 12, 'USED', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#bfa9db',
          letterSpacing: '0.12em',
        }).setOrigin(0.5);

        room.usedValue = this.add.text(room.x - 58, room.y + 16, '0 GB', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#e6d9ff',
        }).setOrigin(0.5);

        room.freeLabel = this.add.text(room.x + 58, room.y - 12, 'FREE', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#bfa9db',
          letterSpacing: '0.12em',
        }).setOrigin(0.5);

        room.freeValue = this.add.text(room.x + 58, room.y + 16, '0 GB', {
          fontFamily: 'monospace',
          fontSize: '22px',
          color: '#e6d9ff',
        }).setOrigin(0.5);

        room.status = this.add.text(room.x, room.y + 62, 'CLICK TO INSPECT', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#7ef7d6',
          letterSpacing: '0.12em',
        }).setOrigin(0.5);

        room.background.setInteractive({ useHandCursor: true });
        room.background.on('pointerdown', () => this.toggleStorageWindow(room));
      }
    });

    this.createStorageWindow();
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

    const backdrop = this.add.rectangle(0, 0, 430, 240, 0x120b1b, 0.96);
    backdrop.setStrokeStyle(2, PALETTE.accent, 0.8);

    const header = this.add.text(0, -82, 'DRIVE HEALTH', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#f3ebff',
      letterSpacing: '0.12em',
    }).setOrigin(0.5);

    const usedText = this.add.text(-140, -12, 'Used: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#e6d9ff',
    });

    const freeText = this.add.text(80, -12, 'Free: 0 GB', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#e6d9ff',
    });

    const healthText = this.add.text(0, 40, 'Status: HEALTHY', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#7ef7d6',
      letterSpacing: '0.08em',
    }).setOrigin(0.5);

    const hintText = this.add.text(0, 78, 'click the room again to close', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#bfa9db',
      letterSpacing: '0.08em',
    }).setOrigin(0.5);

    this.storageWindow.add([backdrop, header, usedText, freeText, healthText, hintText]);
    this.storageUsedText = usedText;
    this.storageFreeText = freeText;
    this.storageHealthText = healthText;
  }

  toggleStorageWindow(room) {
    this.storageOpen = !this.storageOpen;
    this.storageWindow.setVisible(this.storageOpen);
    if (this.storageOpen) {
      room.background.setFillStyle(0x26163a, 0.98);
      room.background.setStrokeStyle(2, PALETTE.good, 0.9);
    } else {
      room.background.setFillStyle(PALETTE.panelFill, 0.94);
      room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
    }
  }

  updateRoomTelemetry() {
    const cpu = Math.max(0, Math.min(100, this.metrics.cpu_percent || 0));
    const ram = Math.max(0, Math.min(100, this.metrics.ram_percent || 0));
    const disk = Math.max(0, Math.min(100, this.metrics.disk_percent || 0));
    const usedGb = Number(this.metrics.disk_used_gb || 0);
    const freeGb = Number(this.metrics.disk_free_gb || 0);
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
    storageRoom.usedValue.setText(`${usedGb.toFixed(1)} GB`);
    storageRoom.freeValue.setText(`${freeGb.toFixed(1)} GB`);
    storageRoom.status.setText(disk > 80 ? 'DRIVE NEAR LIMIT' : 'CLICK TO INSPECT');
    storageRoom.status.setColor(disk > 80 ? '#f9c74f' : '#7ef7d6');

    this.storageUsedText.setText(`Used: ${usedGb.toFixed(1)} GB`);
    this.storageFreeText.setText(`Free: ${freeGb.toFixed(1)} GB`);
    this.storageHealthText.setText(disk > 80 ? 'Status: WATCH' : 'Status: HEALTHY');
    this.storageHealthText.setColor(disk > 80 ? '#f9c74f' : '#7ef7d6');
  }
}

export default ShipScene;
