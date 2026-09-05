const PALETTE = {
  bg: 0x182028,
  skyTop: 0x7ea8cc,
  skyBottom: 0xaed3eb,
  grassA: 0x6ea650,
  grassB: 0x5c8d45,
  earth: 0x6f5534,
  stone: 0x6d6a64,
  panelFill: 0x2f241a,
  panelStroke: 0xb79965,
  titleBarFill: 0x4d3926,
  gridLine: 0x96774c,
  accent: 0xd9b777,
  accentBright: 0xf8ddb1,
  gaugeTrack: 0x473323,
  good: 0x8ccf7a,
  warning: 0xf9c74f,
  danger: 0xff6b6b,
  offline: 0x31261f,
};

const STAR_COLORS = [0xf2e7c9, 0xdac693, 0xbd9f70, 0xceb17f];

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
    return '#f2bd69';
  }
  return '#e9d1a6';
}

class ShipScene extends Phaser.Scene {
  constructor() {
    super('ShipScene');

    const backendOverride = new URLSearchParams(window.location.search).get('backend');
    const socketHost = backendOverride || window.location.host;
    const socketProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

    this.wsUrl = `${socketProtocol}://${socketHost}/ws`;
    this.roomRegistry = [
      { id: 'helm', name: 'War Table', x: 0.5, y: 0.25, width: 0.5, height: 0.24 },
      { id: 'engine', name: 'Forge', x: 0.28, y: 0.6, width: 0.36, height: 0.46 },
      { id: 'storage', name: 'Granary', x: 0.71, y: 0.6, width: 0.42, height: 0.46 },
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
    this.colonistPawns = [];
  }

  create() {
    this.cameras.main.setBackgroundColor(PALETTE.bg);
    this.cameras.main.roundPixels = true;

    this.createPixelWorldBackdrop();
    this.createStarfield();
    this.createStationFrame();
    this.createRoomModules();
    this.createColonistPawns();
    this.startHelmMockTicker();

    this.connectSocket();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.monitorTelemetryHeartbeat(),
    });

    this.addHelmEvent('info', 'helm', 'Castle watch online (MOCK)');
    this.addHelmEvent('info', 'engine', 'Forge stewards await telemetry link');
    this.applyRoomPower(false);
  }

  createPixelWorldBackdrop() {
    const { width, height } = this.scale;
    const tile = 16;
    const groundStartY = Math.floor(height * 0.56);
    const bg = this.add.graphics().setDepth(-22);

    for (let y = 0; y < groundStartY; y += tile) {
      const lerp = y / groundStartY;
      const top = Phaser.Display.Color.IntegerToColor(PALETTE.skyTop);
      const bottom = Phaser.Display.Color.IntegerToColor(PALETTE.skyBottom);
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 100, lerp * 100);
      const color = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
      bg.fillStyle(color, 1);
      bg.fillRect(0, y, width, tile);
    }

    for (let y = groundStartY; y < height; y += tile) {
      const isAlt = Math.floor(y / tile) % 2 === 0;
      bg.fillStyle(isAlt ? PALETTE.grassA : PALETTE.grassB, 1);
      bg.fillRect(0, y, width, tile);
    }

    bg.fillStyle(PALETTE.earth, 1);
    bg.fillRect(0, height - tile * 3, width, tile * 3);

    const hills = this.add.graphics().setDepth(-20);
    hills.fillStyle(0x6f8f67, 1);
    for (let x = -tile; x < width + tile; x += tile) {
      const hillHeight = Phaser.Math.Between(2, 6) * tile;
      hills.fillRect(x, groundStartY - hillHeight, tile, hillHeight);
    }

    const road = this.add.graphics().setDepth(-19);
    road.fillStyle(0x8e6f4a, 1);
    for (let y = groundStartY; y < height; y += tile) {
      const spread = Math.floor((y - groundStartY) / tile) * 8;
      road.fillRect(width * 0.5 - 12 - spread, y, 24 + spread * 2, tile);
    }

    this.createKingdomSilhouette(width * 0.5, groundStartY - tile * 2, tile);
  }

  createKingdomSilhouette(centerX, baselineY, tile) {
    const keep = this.add.graphics().setDepth(-18);
    const wallColor = PALETTE.stone;
    const shadowColor = 0x4f4c47;

    keep.fillStyle(wallColor, 1);
    keep.fillRect(centerX - tile * 7, baselineY - tile * 5, tile * 14, tile * 5);
    keep.fillRect(centerX - tile * 3, baselineY - tile * 10, tile * 6, tile * 10);

    keep.fillRect(centerX - tile * 10, baselineY - tile * 7, tile * 3, tile * 7);
    keep.fillRect(centerX + tile * 7, baselineY - tile * 7, tile * 3, tile * 7);

    keep.fillStyle(shadowColor, 1);
    keep.fillRect(centerX - tile * 1, baselineY - tile * 5, tile * 2, tile * 5);

    keep.fillStyle(0x3d2e1f, 1);
    keep.fillRect(centerX - tile, baselineY - tile * 2, tile * 2, tile * 2);

    keep.fillStyle(wallColor, 1);
    for (let i = -7; i < 7; i += 2) {
      keep.fillRect(centerX + i * tile, baselineY - tile * 6, tile, tile);
    }
    for (let i = -3; i < 3; i += 2) {
      keep.fillRect(centerX + i * tile, baselineY - tile * 11, tile, tile);
    }
  }

  update(time, delta) {
    this.updateStarfield(delta);
    this.updateColonistPawns(delta);
  }

  connectSocket() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      const wasOffline = !this.connectionState.online;
      this.connectionState.online = true;
      this.connectionState.lastMessageAt = Date.now();
      this.applyRoomPower(true);
      if (wasOffline) {
        this.addHelmEvent('info', 'helm', 'Messenger uplink restored');
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
        this.addHelmEvent('warn', 'helm', 'Malformed raven report discarded');
      }
    });

    this.socket.addEventListener('close', () => {
      const hadLink = this.connectionState.online;
      this.connectionState.online = false;
      this.applyRoomPower(false);
      if (hadLink) {
        this.addHelmEvent('warn', 'helm', 'Messenger uplink lost');
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
      this.addHelmEvent('warn', 'helm', 'Telemetry timed out; keep in torchlight mode');
    }
  }

  createStarfield() {
    const { width, height } = this.scale;
    this.starLayer = this.add.container(0, 0).setDepth(-14);

    for (let i = 0; i < 90; i += 1) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, Math.floor(height * 0.55));
      const size = Phaser.Math.Between(1, 2) * 2;
      const dot = this.add.rectangle(x, y, size, size, Phaser.Utils.Array.GetRandom(STAR_COLORS), Phaser.Math.FloatBetween(0.18, 0.5));
      dot.starSpeed = Phaser.Math.FloatBetween(5, 18);
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
      dot.y += Math.sin((dot.x + dot.y) * 0.002) * 0.015 * delta;
      if (dot.x < -5) {
        dot.x = width + Phaser.Math.Between(4, 18);
        dot.y = Phaser.Math.Between(0, Math.floor(height * 0.55));
      }
    });
  }

  createStationFrame() {
    const { width, height } = this.scale;

    this.add.text(width * 0.5, height * 0.07, 'KINGDOM PLAINS WATCH', {
      fontFamily: 'monospace',
      fontSize: '30px',
      color: '#f2ddba',
    }).setOrigin(0.5);

    this.add.text(width * 0.5, height * 0.106, 'PIXEL COLONY STATUS BOARD', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#cba779',
    }).setOrigin(0.5);

    const hull = this.add.graphics().setDepth(-2);
    hull.lineStyle(2, PALETTE.gridLine, 0.42);
    hull.strokeRect(width * 0.06, height * 0.14, width * 0.88, height * 0.76);

    hull.lineStyle(1, PALETTE.gridLine, 0.2);
    for (let x = 0; x <= 18; x += 1) {
      const px = width * (0.08 + (x / 18) * 0.84);
      hull.lineBetween(px, height * 0.16, px, height * 0.88);
    }

    for (let y = 0; y <= 12; y += 1) {
      const py = height * (0.16 + (y / 12) * 0.72);
      hull.lineBetween(width * 0.08, py, width * 0.92, py);
    }

    const corridor = this.add.graphics().setDepth(-1);
    corridor.fillStyle(0x3a281b, 0.7);
    corridor.fillRect(width * 0.43, height * 0.37, width * 0.14, height * 0.18);
    corridor.lineStyle(1, PALETTE.panelStroke, 0.4);
    corridor.strokeRect(width * 0.43, height * 0.37, width * 0.14, height * 0.18);
  }

  createRoomModules() {
    this.roomMap = new Map();

    this.roomRegistry.forEach((config) => {
      const room = this.createModuleRoom(config);
      this.roomMap.set(config.id, room);

      room.label = this.add.text(room.x, room.y - room.height / 2 - 24, config.name.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f7e4c4',
        backgroundColor: 'rgba(48, 32, 20, 0.92)',
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
      color: '#f2ddb3',
    }).setOrigin(0.5);

    room.ramLabel = this.add.text(room.x + 82, room.y + 14, 'RAM OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f2ddb3',
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

    room.connectionText = this.add.text(room.x - room.width / 2 + 38, room.y - room.height / 2 + 22, 'SCOUTS OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffc4a1',
    }).setOrigin(0, 0.5);

    room.mockTag = this.add.text(room.x + room.width / 2 - 10, room.y - room.height / 2 + 22, 'MOCK SCROLL', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f2bd69',
      backgroundColor: '#3f2a16',
      padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5);

    room.relayText = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 50, 'MOCK SCOUT LOAD 0%', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e9d1a6',
    }).setOrigin(0, 0.5);

    room.pingText = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 74, 'MOCK RIDER RTT 0 ms', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e9d1a6',
    }).setOrigin(0, 0.5);

    room.feedTitle = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 104, 'WAR TABLE NOTICES', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#f2ddba',
    }).setOrigin(0, 0.5);

    room.feedLines = [];
    for (let i = 0; i < this.maxHelmFeed; i += 1) {
      const line = this.add.text(room.x - room.width / 2 + 20, room.y - room.height / 2 + 126 + i * 18, '-', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e9d1a6',
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
      color: '#f7e5c4',
    }).setOrigin(0.5);

    room.diskUsedText = this.add.text(leftX, room.y - 34, 'USED   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.diskTotalText = this.add.text(leftX, room.y, 'TOTAL  OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.diskFreeText = this.add.text(leftX, room.y + 34, 'FREE   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.diskStatus = this.add.text(leftX, room.y + room.height / 2 - 26, 'HEARTH COLD', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ff6b6b',
    }).setOrigin(0.5);

    room.mediaHeader = this.add.text(rightX, room.y - room.height / 2 + 32, 'MEDIA POOL', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#f7e5c4',
    }).setOrigin(0.5);

    room.mediaUsedText = this.add.text(rightX, room.y - 34, 'USED   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.mediaTotalText = this.add.text(rightX, room.y, 'TOTAL  OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.mediaFreeText = this.add.text(rightX, room.y + 34, 'FREE   OFFLINE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f7dfba',
    }).setOrigin(0.5);

    room.mediaStatus = this.add.text(rightX, room.y + room.height / 2 - 26, 'HEARTH COLD', {
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
        this.addHelmEvent('warn', 'storage', 'Granary controls locked while dark');
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
        this.addHelmEvent('warn', 'storage', 'Storehouse controls locked while dark');
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

  createColonistPawns() {
    const { width, height } = this.scale;
    const roomIds = this.roomRegistry.map((room) => room.id);
    for (let i = 0; i < 8; i += 1) {
      const pawn = this.add.circle(
        Phaser.Math.Between(width * 0.12, width * 0.88),
        Phaser.Math.Between(height * 0.19, height * 0.85),
        Phaser.Math.FloatBetween(2.0, 3.2),
        Phaser.Math.RND.pick([0xffd07f, 0xeeb96d, 0xd9a763, 0xffe2b0]),
        Phaser.Math.FloatBetween(0.5, 0.9),
      );
      pawn.setDepth(-1);
      pawn.speed = Phaser.Math.FloatBetween(28, 48);
      pawn.waitMs = Phaser.Math.Between(250, 1500);
      pawn.targetRoomId = roomIds[i % roomIds.length];
      pawn.targetPoint = this.getRoomAnchor(pawn.targetRoomId);
      this.colonistPawns.push(pawn);
    }
  }

  getRoomAnchor(roomId) {
    const room = this.roomMap.get(roomId);
    if (!room) {
      return { x: this.scale.width * 0.5, y: this.scale.height * 0.5 };
    }

    return {
      x: Phaser.Math.Between(room.x - room.width * 0.24, room.x + room.width * 0.24),
      y: Phaser.Math.Between(room.y - room.height * 0.24, room.y + room.height * 0.24),
    };
  }

  choosePawnTargetRoom() {
    if (!this.connectionState.online) {
      return 'helm';
    }

    if (this.alertFlags.cpuHot || this.alertFlags.ramHot) {
      return Math.random() > 0.35 ? 'engine' : 'helm';
    }

    if (this.alertFlags.diskHot) {
      return Math.random() > 0.35 ? 'storage' : 'helm';
    }

    return Phaser.Math.RND.pick(['engine', 'storage', 'helm']);
  }

  updateColonistPawns(delta) {
    const dt = delta / 1000;

    this.colonistPawns.forEach((pawn) => {
      if (!pawn.targetPoint) {
        pawn.targetRoomId = this.choosePawnTargetRoom();
        pawn.targetPoint = this.getRoomAnchor(pawn.targetRoomId);
      }

      if (pawn.waitMs > 0) {
        pawn.waitMs -= delta;
        return;
      }

      const dx = pawn.targetPoint.x - pawn.x;
      const dy = pawn.targetPoint.y - pawn.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 4) {
        pawn.waitMs = Phaser.Math.Between(300, 1400);
        pawn.targetRoomId = this.choosePawnTargetRoom();
        pawn.targetPoint = this.getRoomAnchor(pawn.targetRoomId);
        return;
      }

      const vx = (dx / distance) * pawn.speed * dt;
      const vy = (dy / distance) * pawn.speed * dt;
      pawn.x += vx;
      pawn.y += vy;
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

        helm.relayText.setText(`MOCK SCOUT LOAD ${this.mockHelm.relayLoad}%`);
        helm.pingText.setText(`MOCK RIDER RTT ${this.mockHelm.pingMs} ms`);

        if (this.connectionState.online && Math.random() > 0.7) {
          this.addHelmEvent('info', 'helm', 'Night watch reports all clear (MOCK)');
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
        line.setColor('#e9d1a6');
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
        room.background.setStrokeStyle(2, 0x66533f, 0.8);
        room.titleStrip.setFillStyle(0x4d3b2a, 0.7);
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
          room.connectionText.setText('SCOUTS ONLINE');
          room.connectionText.setColor('#7ef7d6');
        } else {
          room.statusLamp.setFillStyle(PALETTE.danger, 0.95);
          room.connectionText.setText('SCOUTS OFFLINE');
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

    const header = this.add.text(0, -165, 'GRANARY HEALTH', {
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

    const hintText = this.add.text(0, 158, 'click the chamber again to close', {
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
        this.storageHealthLabel.setText('SOUND (SMART PASSED)');
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
      this.storageHealthDetail.setText('Could not reach granary health endpoint.');
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

    const header = this.add.text(0, -170, 'STOREHOUSE BREAKDOWN', {
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

    const hintText = this.add.text(0, 165, 'scroll to browse - click the chamber again to close', {
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
      : 'Storehouse volume not mounted');

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
