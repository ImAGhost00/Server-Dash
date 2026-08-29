class ShipScene extends Phaser.Scene {
  constructor() {
    super('ShipScene');
    this.wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    this.roomRegistry = [
      { id: 'engine', name: 'Engine Room', x: 0.32, y: 0.38, width: 0.24, height: 0.36 },
    ];
    this.metrics = {
      cpu_percent: 0,
      ram_percent: 0,
      disk_percent: 0,
    };
    this.socket = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#050b11');
    this.createStationHull();
    this.createRoomModules();
    this.connectSocket();
  }

  connectSocket() {
    this.socket = new WebSocket(this.wsUrl);

    this.socket.addEventListener('open', () => {
      console.log('WebSocket connected');
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'metrics' && payload.data) {
          this.metrics = payload.data;
          this.updateEngineRoomTelemetry();
        }
      } catch (error) {
        console.error('Invalid websocket payload', error);
      }
    });

    this.socket.addEventListener('close', () => {
      console.warn('WebSocket disconnected, retrying...');
      setTimeout(() => this.connectSocket(), 2000);
    });
  }

  createStationHull() {
    const { width, height } = this.scale;

    this.add.rectangle(width * 0.5, height * 0.57, width * 0.9, height * 0.52, 0x1d2f35, 1)
      .setStrokeStyle(3, 0x7ef9c6, 0.7);

    this.add.rectangle(width * 0.5, height * 0.5, width * 0.72, height * 0.7, 0x3a4a4e, 0.28)
      .setStrokeStyle(2, 0x90a4ab, 0.8);

    for (let i = 0; i < 12; i += 1) {
      const y = height * 0.18 + i * (height * 0.055);
      this.add.line(0, y, width * 0.12, y, width * 0.88, y, 0x7ef9c6, 0.28).setLineWidth(1);
    }

    this.add.rectangle(width * 0.5, height * 0.78, width * 0.78, 10, 0x7ef9c6, 0.35);
    this.add.rectangle(width * 0.5, height * 0.85, width * 0.68, 8, 0x7ef9c6, 0.18);

    const stern = this.add.rectangle(width * 0.14, height * 0.58, 18, height * 0.5, 0x7ef9c6, 0.15);
    const bow = this.add.rectangle(width * 0.86, height * 0.58, 18, height * 0.5, 0x7ef9c6, 0.15);
    stern.setStrokeStyle(2, 0x7ef9c6, 0.4);
    bow.setStrokeStyle(2, 0x7ef9c6, 0.4);

    this.add.text(width * 0.5, height * 0.12, 'SPACESHIP STATION', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#7ef9c6',
      letterSpacing: '0.22em',
    }).setOrigin(0.5);
  }

  createRoomModules() {
    this.engineRoom = this.createModuleRoom(this.roomRegistry[0]);
    this.engineRoomText = this.add.text(this.engineRoom.x, this.engineRoom.y - 14, 'ENGINE ROOM / CORE INTELLIGENCE', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#d7f7ef',
      backgroundColor: 'rgba(0,0,0,0.2)',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5);

    this.engineCore = this.add.circle(this.engineRoom.x, this.engineRoom.y + 12, 24, 0x7ef9c6, 0.9);
    this.engineCore.setStrokeStyle(2, 0x9af6d0, 1);
    this.engineCoreGlow = this.add.circle(this.engineRoom.x, this.engineRoom.y + 12, 42, 0x7ef9c6, 0.18);

    this.cpuText = this.add.text(this.engineRoom.x - 54, this.engineRoom.y + 66, 'CPU 0%', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#7ef9c6',
    });

    this.ramText = this.add.text(this.engineRoom.x + 10, this.engineRoom.y + 66, 'RAM 0%', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#7ef9c6',
    });

    this.engineGaugeCpu = this.add.rectangle(this.engineRoom.x - 48, this.engineRoom.y + 92, 92, 10, 0x2a3b3d, 1);
    this.engineGaugeCpu.setStrokeStyle(1, 0x7ef9c6, 0.7);
    this.engineGaugeCpuFill = this.add.rectangle(this.engineRoom.x - 48, this.engineRoom.y + 92, 0, 8, 0x7ef9c6, 1);
    this.engineGaugeCpuFill.setOrigin(0, 0.5);

    this.engineGaugeRam = this.add.rectangle(this.engineRoom.x + 54, this.engineRoom.y + 92, 92, 10, 0x2a3b3d, 1);
    this.engineGaugeRam.setStrokeStyle(1, 0x7ef9c6, 0.7);
    this.engineGaugeRamFill = this.add.rectangle(this.engineRoom.x + 54, this.engineRoom.y + 92, 0, 8, 0x7ef9c6, 1);
    this.engineGaugeRamFill.setOrigin(0, 0.5);

    this.enginePulse = this.tweens.add({
      targets: [this.engineCoreGlow],
      scale: { from: 1, to: 1.65 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  createModuleRoom(roomConfig) {
    const { width, height } = this.scale;
    const roomX = width * roomConfig.x;
    const roomY = height * roomConfig.y;
    const roomWidth = width * roomConfig.width;
    const roomHeight = height * roomConfig.height;

    const room = this.add.rectangle(roomX, roomY, roomWidth, roomHeight, 0x182a2e, 0.8);
    room.setStrokeStyle(2, 0x8ea7ab, 0.9);

    const titleBar = this.add.rectangle(roomX, roomY - roomHeight * 0.45, roomWidth * 0.8, 18, 0x213a40, 1);
    titleBar.setStrokeStyle(1, 0x7ef9c6, 0.7);

    return {
      x: roomX,
      y: roomY,
      width: roomWidth,
      height: roomHeight,
      background: room,
      title: titleBar,
    };
  }

  updateEngineRoomTelemetry() {
    const cpu = Math.max(0, Math.min(100, this.metrics.cpu_percent || 0));
    const ram = Math.max(0, Math.min(100, this.metrics.ram_percent || 0));
    const warning = cpu > 80;

    this.cpuText.setText(`CPU ${cpu.toFixed(1)}%`);
    this.ramText.setText(`RAM ${ram.toFixed(1)}%`);

    const cpuWidth = 92 * (cpu / 100);
    const ramWidth = 92 * (ram / 100);

    this.engineGaugeCpuFill.width = cpuWidth;
    this.engineGaugeCpuFill.fillColor = warning ? 0xf9c74f : 0x7ef9c6;
    this.engineGaugeRamFill.width = ramWidth;
    this.engineGaugeRamFill.fillColor = ram > 80 ? 0xff6b6b : 0x7ef9c6;

    this.engineRoom.background.setFillStyle(warning ? 0x3a2a1b : 0x182a2e, 0.82);
    this.engineRoom.background.setStrokeStyle(2, warning ? 0xf9c74f : 0x8ea7ab, 0.9);

    const baseDuration = 1200;
    const pulseFactor = 1 + (cpu / 100) * 1.8;
    const newDuration = Math.max(300, baseDuration / pulseFactor);
    this.enginePulse.stop();
    this.enginePulse = this.tweens.add({
      targets: [this.engineCoreGlow],
      scale: { from: 1, to: 1.65 },
      duration: newDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.engineCoreGlow.setFillStyle(warning ? 0xff6b6b : 0x7ef9c6, 0.2);
    this.engineCore.setFillStyle(warning ? 0xffad60 : 0x7ef9c6, 0.95);
    this.engineCoreGlow.setAlpha(Math.min(1, 0.18 + cpu / 250));
  }
}

export default ShipScene;
