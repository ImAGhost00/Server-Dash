const PALETTE = {
  bg: 0x070b12,
  panelFill: 0x111c28,
  panelStroke: 0x74a2c9,
  titleBarFill: 0x1d3247,
  gridLine: 0x5f89ac,
  accent: 0x82d9ff,
  accentBright: 0xd4f5ff,
  gaugeTrack: 0x223547,
  good: 0x7ef7d6,
  warning: 0xf9c74f,
  danger: 0xff6b6b,
  offline: 0x2a3440,
};

const STAR_COLORS = [0x9ec8ff, 0xb9ddff, 0x8ab6eb, 0xc8e8ff];

function formatStorageValue(gb) {
  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(2)} TB`;
  }
  return `${gb.toFixed(1)} GB`;
}

function levelColor(level) {
  if (level === 'error') {
    return '#ff6b6b';
  }
  if (level === 'warn') {
    return '#f9c74f';
  }
  return '#9be8ff';
}

class ShipScene extends Phaser.Scene {
  constructor() {
    super('ShipScene');

    const backendOverride = new URLSearchParams(window.location.search).get('backend');
    const socketHost = backendOverride || window.location.host;
    const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    this.wsUrl = `${socketProtocol}://${socketHost}/ws`;
    this.roomRegistry = [
      { id: 'helm', name: 'Helm', x: 0.5, y: 0.25, width: 0.5, height: 0.24 },
      { id: 'engine', name: 'Engine Room', x: 0.28, y: 0.6, width: 0.36, height: 0.46 },
      { id: 'storage', name: 'Storage Bay', x: 0.71, y: 0.6, width: 0.42, height: 0.46 },
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
    this.connectionState = {
      online: false,
      lastMessageAt: 0,
    };

    this.helmFeed = [];
    this.maxHelmFeed = 7;
    this.mockHelm = {
      relayLoad: 36,
      pingMs: 24,
    };

    this.alertFlags = {
      cpuHot: false,
      ramHot: false,
      diskHot: false,
    };

    this.starDots = [];
    this.ambientDrones = [];
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);

    this.createStarfield();
    this.createStationFrame();
    this.createRoomModules();
    this.createAmbientDrones();
    this.startHelmMockTicker();

    this.connectSocket();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.monitorTelemetryHeartbeat(),
    });

    this.addHelmEvent('info', 'helm', 'Boot sequence complete (MOCK)');
    this.addHelmEvent('info', 'engine', 'Waiting for telemetry link');
    this.applyRoomPower(false);
  }

  update(time, delta) {
    this.updateStarfield(delta);
    this.updateAmbientDrones(delta);
  }

  connectSocket() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      const wasOffline = !this.connectionState.online;
      this.connectionState.online = true;
      this.connectionState.lastMessageAt = Date.now();
      this.applyRoomPower(true);
      if (wasOffline) {
        this.addHelmEvent('info', 'helm', 'Telemetry uplink restored');
      }
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'metrics' && payload.data) {
          this.metrics = payload.data;
          this.connectionState.online = true;
          this.connectionState.lastMessageAt = Date.now();
          this.applyRoomPower(true);
          this.updateRoomTelemetry();
        }
      } catch (error) {
        console.error('Invalid websocket payload', error);
        this.addHelmEvent('warn', 'helm', 'Malformed telemetry payload dropped');
      }
    });

    this.socket.addEventListener('close', () => {
      const hadLink = this.connectionState.online;
      this.connectionState.online = false;
      this.applyRoomPower(false);
      if (hadLink) {
        this.addHelmEvent('warn', 'helm', 'Telemetry uplink lost');
      }
      setTimeout(() => this.connectSocket(), 2000);
    });
  }

  monitorTelemetryHeartbeat() {
    if (!this.connectionState.online) {
      return;
    }

    if (Date.now() - this.connectionState.lastMessageAt > 7000) {
      this.connectionState.online = false;
      this.applyRoomPower(false);
      this.addHelmEvent('warn', 'helm', 'Telemetry timed out; rooms in safe mode');
    }
  }

  createStarfield() {
    const { width, height } = this.scale;
    this.starLayer = this.add.container(0, 0).setDepth(-12);

    for (let i = 0; i < 160; i += 1) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const radius = Phaser.Math.FloatBetween(0.7, 2.2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
      const dot = this.add.circle(x, y, radius, Phaser.Utils.Array.GetRandom(STAR_COLORS), alpha);
      dot.starSpeed = Phaser.Math.FloatBetween(8, 52);
      dot.parallaxScale = Phaser.Math.FloatBetween(0.85, 1.25);
      this.starLayer.add(dot);
      this.starDots.push(dot);
    }
  }

  updateStarfield(delta) {
    const { width, height } = this.scale;
    const drift = delta / 1000;

    this.starDots.forEach((dot) => {
      dot.x -= dot.starSpeed * drift * dot.parallaxScale;
      dot.y += Math.sin((dot.x + dot.y) * 0.002) * 0.03 * delta;
      if (dot.x < -5) {
        dot.x = width + Phaser.Math.Between(4, 18);
        dot.y = Phaser.Math.Between(0, height);
      }
    });
  }

  createStationFrame() {
    const { width, height } = this.scale;

    this.add.text(width * 0.5, height * 0.07, 'COLONY COMMAND DECK', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#d7efff',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, height * 0.106, 'RIMWORLD STYLE HARDWARE OVERWATCH', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#86b9de',
    }).setOrigin(0.5);

    const hull = this.add.graphics();
    hull.lineStyle(2, PALETTE.gridLine, 0.28);
    hull.strokeRoundedRect(width * 0.06, height * 0.14, width * 0.88, height * 0.76, 18);

    hull.lineStyle(1, PALETTE.gridLine, 0.12);
    for (let x = 0; x <= 12; x += 1) {
      const px = width * (0.08 + (x / 12) * 0.84);
      hull.lineBetween(px, height * 0.16, px, height * 0.88);
    }

    for (let y = 0; y <= 9; y += 1) {
      const py = height * (0.16 + (y / 9) * 0.72);
      hull.lineBetween(width * 0.08, py, width * 0.92, py);
    }

    const corridor = this.add.graphics();
    corridor.fillStyle(0x112131, 0.7);
    corridor.fillRoundedRect(width * 0.43, height * 0.37, width * 0.14, height * 0.18, 16);
    corridor.lineStyle(1, PALETTE.panelStroke, 0.4);
    corridor.strokeRoundedRect(width * 0.43, height * 0.37, width * 0.14, height * 0.18, 16);
  }

  createRoomModules() {
    this.roomMap = new Map();

    this.roomRegistry.forEach((config) => {
      const room = this.createModuleRoom(config);
      this.roomMap.set(config.id, room);

      room.label = this.add.text(room.x, room.y - room.height / 2 - 24, config.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e7f6ff',
        backgroundColor: 'rgba(8, 17, 28, 0.92)',
        padding: { x: 8, y: 4 },
      }).setOrigin(0.5).setVisible(false);

      room.background.setInteractive({ useHandCursor: true });
      room.background.on('pointerover', () => {
        room.label.setVisible(true);
        if (room.isOnline) {
          room.background.setStrokeStyle(2, PALETTE.accentBright, 1);
        }
      });
      room.background.on('pointerout', () => {
        room.label.setVisible(false);
        if (room.isOnline) {
          room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
        }
      });

      if (config.id === 'engine') {
        this.createEngineRoom(room);
      }

      if (config.id === 'storage') {
        this.createStorageBay(room);
      }

      if (config.id === 'helm') {
        this.createHelmRoom(room);
      }
    });

    this.createStorageWindow();
    this.createMediaWindow();
  }

  createEngineRoom(room) {
    room.coreGlow = this.add.circle(room.x, room.y - 90, 48, PALETTE.accent, 0.18);
    room.core = this.add.circle(room.x, room.y - 90, 26, PALETTE.accent, 0.9);
    room.core.setStrokeStyle(2, PALETTE.accentBright, 1);

    room.cpuLabel = this.add.text(room.x - 82, room.y + 14, 'CPU OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d4bbff',
    }).setOrigin(0.5);

    room.ramLabel = this.add.text(room.x + 82, room.y + 14, 'RAM OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d4bbff',
    }).setOrigin(0.5);

    room.cpuGauge = this.add.rectangle(room.x - 82, room.y + 42, 120, 10, PALETTE.gaugeTrack, 1)
      .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
    room.cpuGaugeFill = this.add.rectangle(room.x - 142, room.y + 42, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

    room.ramGauge = this.add.rectangle(room.x + 82, room.y + 42, 120, 10, PALETTE.gaugeTrack, 1)
      .setStrokeStyle(1, PALETTE.panelStroke, 0.7);
    room.ramGaugeFill = this.add.rectangle(room.x + 22, room.y + 42, 0, 8, PALETTE.accent, 1).setOrigin(0, 0.5);

    room.pulse = this.tweens.add({
      targets: [room.coreGlow],
      scale: { from: 1, to: 1.7 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  createHelmRoom(room) {
    room.statusLamp = this.add.circle(room.x - room.width / 2 + 24, room.y - room.height / 2 + 22, 6, PALETTE.danger, 0.9)
      .setStrokeStyle(1, PALETTE.panelStroke, 0.7);

    room.connectionText = this.add.text(room.x - room.width / 2 + 38, room.y - room.height / 2 + 22, 'UPLINK OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff9d9d',
    }).setOrigin(0, 0.5);

    room.mockTag = this.add.text(room.x + room.width / 2 - 10, room.y - room.height / 2 + 22, 'MOCK BUS', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f9c74f',
      backgroundColor: '#2f2310',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5);

    room.relayText = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 50, 'MOCK RELAY LOAD 0%', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#c9ecff',
    }).setOrigin(0, 0.5);

    room.pingText = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 74, 'MOCK RTT 0 ms', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#c9ecff',
    }).setOrigin(0, 0.5);

    room.feedTitle = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 104, 'HELM NOTIFICATIONS', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#d7efff',
    }).setOrigin(0, 0.5);

    room.feedLines = [];
    for (let i = 0; i < this.maxHelmFeed; i += 1) {
      const line = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 126 + i * 18, '-', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9be8ff',
      }).setOrigin(0, 0.5);
      room.feedLines.push(line);
    }
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

    room.diskUsedText = this.add.text(leftX, room.y - 34, 'USED   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskTotalText = this.add.text(leftX, room.y, 'TOTAL  OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskFreeText = this.add.text(leftX, room.y + 34, 'FREE   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.diskStatus = this.add.text(leftX, room.y + room.height / 2 - 26, 'OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ff6b6b',
    }).setOrigin(0.5);

    room.mediaHeader = this.add.text(rightX, room.y - room.height / 2 + 32, 'MEDIA POOL', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f3ebff',
    }).setOrigin(0.5);

    room.mediaUsedText = this.add.text(rightX, room.y - 34, 'USED   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaTotalText = this.add.text(rightX, room.y, 'TOTAL  OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaFreeText = this.add.text(rightX, room.y + 34, 'FREE   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e6d9ff',
    }).setOrigin(0.5);

    room.mediaStatus = this.add.text(rightX, room.y + room.height / 2 - 26, 'OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ff6b6b',
    }).setOrigin(0.5);

    const zoneWidth = room.width / 2;
    const hoverHandlers = () => ({
      pointerover: () => {
        room.label.setVisible(true);
        if (room.isOnline) {
          room.background.setStrokeStyle(2, PALETTE.accentBright, 1);
        }
      },
      pointerout: () => {
        room.label.setVisible(false);
        if (room.isOnline) {
          room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
        }
      },
    });

    room.diskZone = this.add.rectangle(leftX, room.y, zoneWidth, room.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    const diskHover = hoverHandlers();
    room.diskZone.on('pointerover', diskHover.pointerover);
    room.diskZone.on('pointerout', diskHover.pointerout);
    room.diskZone.on('pointerdown', () => {
      if (!room.isOnline) {
        this.addHelmEvent('warn', 'storage', 'Storage controls locked while offline');
        return;
      }
      this.toggleStorageWindow(room);
    });

    room.mediaZone = this.add.rectangle(rightX, room.y, zoneWidth, room.height, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    const mediaHover = hoverHandlers();
    room.mediaZone.on('pointerover', mediaHover.pointerover);
    room.mediaZone.on('pointerout', mediaHover.pointerout);
    room.mediaZone.on('pointerdown', () => {
      if (!room.isOnline) {
        this.addHelmEvent('warn', 'storage', 'Media controls locked while offline');
        return;
      }
      this.toggleMediaWindow(room);
    });
  }

  createModuleRoom(roomConfig) {
    const { width, height } = this.scale;
    const roomX = width * roomConfig.x;
    const roomY = height * roomConfig.y;
    const roomWidth = width * roomConfig.width;
    const roomHeight = height * roomConfig.height;

    const room = this.add.rectangle(roomX, roomY, roomWidth, roomHeight, PALETTE.panelFill, 0.95);
    room.setStrokeStyle(2, PALETTE.panelStroke, 0.9);

    const titleStrip = this.add.rectangle(roomX, roomY - roomHeight / 2 + 14, roomWidth - 8, 18, PALETTE.titleBarFill, 0.65)
      .setStrokeStyle(1, PALETTE.panelStroke, 0.45);

    return {
      id: roomConfig.id,
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
      background: room,
      titleStrip,
      isOnline: false,
    };
  }

  createAmbientDrones() {
    const { width, height } = this.scale;
    for (let i = 0; i < 9; i += 1) {
      const dot = this.add.circle(
        Phaser.Math.Between(width * 0.12, width * 0.88),
        Phaser.Math.Between(height * 0.19, height * 0.85),
        Phaser.Math.FloatBetween(1.4, 2.6),
        0xaee3ff,
        Phaser.Math.FloatBetween(0.2, 0.6),
      );
      dot.vx = Phaser.Math.FloatBetween(-8, 8);
      dot.vy = Phaser.Math.FloatBetween(-5, 5);
      dot.setDepth(-1);
      this.ambientDrones.push(dot);
    }
  }

  updateAmbientDrones(delta) {
    const drift = delta / 1000;
    const minX = this.scale.width * 0.1;
    const maxX = this.scale.width * 0.9;
    const minY = this.scale.height * 0.16;
    const maxY = this.scale.height * 0.88;

    this.ambientDrones.forEach((dot) => {
      dot.x += dot.vx * drift;
      dot.y += dot.vy * drift;

      if (dot.x <= minX || dot.x >= maxX) {
        dot.vx *= -1;
      }
      if (dot.y <= minY || dot.y >= maxY) {
        dot.vy *= -1;
      }
    });
  }

  startHelmMockTicker() {
    this.time.addEvent({
      delay: 2800,
      loop: true,
      callback: () => {
        const helm = this.roomMap.get('helm');
        if (!helm) {
          return;
        }

        this.mockHelm.relayLoad = Phaser.Math.Clamp(this.mockHelm.relayLoad + Phaser.Math.Between(-8, 9), 8, 97);
        this.mockHelm.pingMs = Phaser.Math.Clamp(this.mockHelm.pingMs + Phaser.Math.Between(-5, 7), 9, 140);

        helm.relayText.setText(`MOCK RELAY LOAD ${this.mockHelm.relayLoad}%`);
        helm.pingText.setText(`MOCK RTT ${this.mockHelm.pingMs} ms`);

        if (this.connectionState.online && Math.random() > 0.7) {
          this.addHelmEvent('info', 'helm', 'Patrol loop nominal (MOCK event)');
        }
      },
    });
  }

  addHelmEvent(level, source, message) {
    const stamp = new Date().toLocaleTimeString([], { hour12: false });
    this.helmFeed.unshift({
      level,
      source,
      text: `${stamp} ${source.toUpperCase()} ${message}`,
    });

    if (this.helmFeed.length > this.maxHelmFeed) {
      this.helmFeed.length = this.maxHelmFeed;
    }

    this.renderHelmFeed();
  }

  renderHelmFeed() {
    const helm = this.roomMap.get('helm');
    if (!helm || !helm.feedLines) {
      return;
    }

    helm.feedLines.forEach((line, index) => {
      const entry = this.helmFeed[index];
      if (!entry) {
        line.setText('-');
        line.setColor('#9be8ff');
        return;
      }
      line.setText(entry.text);
      line.setColor(levelColor(entry.level));
    });
  }

  applyRoomPower(isOnline) {
    this.roomMap.forEach((room) => {
      room.isOnline = isOnline;

      if (!isOnline) {
        room.background.setFillStyle(PALETTE.offline, 0.92);
        room.background.setStrokeStyle(2, 0x4f5c66, 0.8);
        room.titleStrip.setFillStyle(0x2b3640, 0.7);
      } else {
        room.background.setFillStyle(PALETTE.panelFill, 0.95);
        room.background.setStrokeStyle(2, PALETTE.panelStroke, 0.9);
        room.titleStrip.setFillStyle(PALETTE.titleBarFill, 0.65);
      }

      if (room.id === 'engine') {
        if (!isOnline) {
          room.cpuLabel.setText('CPU OFFLINE');
          room.ramLabel.setText('RAM OFFLINE');
          room.cpuGaugeFill.width = 0;
          room.ramGaugeFill.width = 0;
          room.coreGlow.setFillStyle(PALETTE.offline, 0.28);
          room.core.setFillStyle(0x4b5966, 0.75);
        }
      }

      if (room.id === 'storage') {
        if (!isOnline) {
          room.diskUsedText.setText('USED   OFFLINE');
          room.diskTotalText.setText('TOTAL  OFFLINE');
          room.diskFreeText.setText('FREE   OFFLINE');
          room.mediaUsedText.setText('USED   OFFLINE');
          room.mediaTotalText.setText('TOTAL  OFFLINE');
          room.mediaFreeText.setText('FREE   OFFLINE');
          room.diskStatus.setText('OFFLINE');
          room.mediaStatus.setText('OFFLINE');
          room.diskStatus.setColor('#ff6b6b');
          room.mediaStatus.setColor('#ff6b6b');
        }

        if (room.diskZone && room.diskZone.input) {
          room.diskZone.input.enabled = isOnline;
        }
        if (room.mediaZone && room.mediaZone.input) {
          room.mediaZone.input.enabled = isOnline;
        }

        if (!isOnline) {
          if (this.storageOpen) {
            this.closeStorageWindow(room);
          }
          if (this.mediaOpen) {
            this.closeMediaWindow(room);
          }
        }
      }

      if (room.id === 'helm') {
        if (isOnline) {
          room.statusLamp.setFillStyle(PALETTE.good, 0.95);
          room.connectionText.setText('UPLINK ONLINE');
          room.connectionText.setColor('#7ef7d6');
        } else {
          room.statusLamp.setFillStyle(PALETTE.danger, 0.95);
          room.connectionText.setText('UPLINK OFFLINE');
          room.connectionText.setColor('#ff9d9d');
        }
      }
    });
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
    room.background.setFillStyle(0x1c2f40, 0.98);
    room.background.setStrokeStyle(2, PALETTE.good, 0.9);
    this.loadDriveHealth();
  }

  closeStorageWindow(room) {
    this.storageOpen = false;
    this.storageWindow.setVisible(false);
    if (!this.mediaOpen && room && room.isOnline) {
      room.background.setFillStyle(PALETTE.panelFill, 0.95);
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
    room.background.setFillStyle(0x1c2f40, 0.98);
    room.background.setStrokeStyle(2, PALETTE.good, 0.9);
    this.loadMediaBreakdown();
  }

  closeMediaWindow(room) {
    this.mediaOpen = false;
    this.mediaWindow.setVisible(false);
    if (!this.storageOpen && room && room.isOnline) {
      room.background.setFillStyle(PALETTE.panelFill, 0.95);
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
    if (!this.connectionState.online) {
      return;
    }

    const cpu = Math.max(0, Math.min(100, this.metrics.cpu_percent || 0));
    const ram = Math.max(0, Math.min(100, this.metrics.ram_percent || 0));
    const diskUsed = Number(this.metrics.disk_used_gb || 0);
    const diskTotal = Number(this.metrics.disk_total_gb || 0);
    const diskFree = Number(this.metrics.disk_free_gb || 0);
    const mediaUsed = Number(this.metrics.media_used_gb || 0);
    const mediaTotal = Number(this.metrics.media_total_gb || 0);
    const mediaFree = Number(this.metrics.media_free_gb || 0);
    const mediaAvailable = Boolean(this.metrics.media_available);

    const engineRoom = this.roomMap.get('engine');
    const cpuWarning = cpu > 80;
    const ramWarning = ram > 80;

    engineRoom.cpuLabel.setText(`CPU ${cpu.toFixed(1)}%`);
    engineRoom.ramLabel.setText(`RAM ${ram.toFixed(1)}%`);
    engineRoom.cpuGaugeFill.width = 120 * (cpu / 100);
    engineRoom.ramGaugeFill.width = 120 * (ram / 100);
    engineRoom.cpuGaugeFill.fillColor = cpuWarning ? PALETTE.warning : PALETTE.accent;
    engineRoom.ramGaugeFill.fillColor = ramWarning ? PALETTE.danger : PALETTE.accent;
    engineRoom.background.setFillStyle(cpuWarning ? 0x3a2e16 : PALETTE.panelFill, 0.95);
    engineRoom.background.setStrokeStyle(2, cpuWarning ? PALETTE.warning : PALETTE.panelStroke, 0.9);
    engineRoom.coreGlow.setFillStyle(cpuWarning ? PALETTE.warning : PALETTE.accent, 0.2);
    engineRoom.core.setFillStyle(cpuWarning ? PALETTE.warning : PALETTE.accent, 0.95);

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

    if (cpu > 85 && !this.alertFlags.cpuHot) {
      this.alertFlags.cpuHot = true;
      this.addHelmEvent('warn', 'engine', `CPU spike ${cpu.toFixed(1)}%`);
    } else if (cpu < 70 && this.alertFlags.cpuHot) {
      this.alertFlags.cpuHot = false;
      this.addHelmEvent('info', 'engine', 'CPU load normalized');
    }

    if (ram > 90 && !this.alertFlags.ramHot) {
      this.alertFlags.ramHot = true;
      this.addHelmEvent('warn', 'engine', `RAM pressure ${ram.toFixed(1)}%`);
    } else if (ram < 75 && this.alertFlags.ramHot) {
      this.alertFlags.ramHot = false;
      this.addHelmEvent('info', 'engine', 'RAM pressure cleared');
    }

    const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;
    if (diskPct > 92 && !this.alertFlags.diskHot) {
      this.alertFlags.diskHot = true;
      this.addHelmEvent('warn', 'storage', `Disk critical ${diskPct.toFixed(1)}% used`);
    } else if (diskPct < 88 && this.alertFlags.diskHot) {
      this.alertFlags.diskHot = false;
      this.addHelmEvent('info', 'storage', 'Disk pressure reduced');
    }
  }
}

export default ShipScene;
