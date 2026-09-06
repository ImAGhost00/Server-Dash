import Phaser from 'phaser';

export class ServerRoomScene extends Phaser.Scene {
  constructor() {
    super('ServerRoomScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08111f');
    this.drawKingdomLandscape();
    this.drawKingdomStructures();
    this.drawBanner();
    this.spawnPawns();
  }

  drawBanner() {
    const title = this.add.text(24, 24, 'Kingdom of Ghost Dash', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#d9f4ff',
      stroke: '#0a1220',
      strokeThickness: 6,
    });

    title.setDepth(20);

    const subtitle = this.add.text(24, 50, 'Pawns roam the keep while telemetry watches over the realm', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#94a3b8',
    });

    subtitle.setDepth(20);
  }

  drawKingdomLandscape() {
    const { width, height } = this.scale;

    const sky = this.add.graphics();
    sky.fillGradientStyle(0x08111f, 0x08111f, 0x0f2440, 0x102338, 1);
    sky.fillRect(0, 0, width, height);

    const hills = this.add.graphics();
    hills.fillStyle(0x0d2430, 1);
    hills.fillEllipse(width * 0.18, height * 0.8, width * 0.5, height * 0.24);
    hills.fillEllipse(width * 0.74, height * 0.78, width * 0.62, height * 0.26);
    hills.setDepth(1);

    const ground = this.add.graphics();
    ground.fillStyle(0x20351d, 1);
    ground.fillRect(0, height * 0.45, width, height * 0.55);
    ground.fillStyle(0x2c4a28, 1);
    ground.fillRect(0, height * 0.58, width, height * 0.42);
    ground.setDepth(2);

    const path = this.add.graphics();
    path.fillStyle(0x6b5b43, 1);
    path.fillRoundedRect(width * 0.18, height * 0.62, width * 0.64, 74, 24);
    path.fillStyle(0x7a6950, 1);
    path.fillRoundedRect(width * 0.21, height * 0.648, width * 0.58, 18, 8);
    path.setDepth(3);

    const water = this.add.graphics();
    water.fillStyle(0x113a58, 0.78);
    water.fillRoundedRect(width * 0.68, height * 0.2, width * 0.22, height * 0.62, 36);
    water.fillStyle(0x1b5c84, 0.35);
    water.fillRoundedRect(width * 0.7, height * 0.24, width * 0.16, height * 0.18, 28);
    water.setDepth(1);

    this.add.text(width - 170, 24, 'The Realm', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#c7d2fe',
    }).setDepth(20);

    this.drawStars(width, height);
  }

  drawStars(width, height) {
    const stars = this.add.graphics();
    stars.fillStyle(0xe2f0ff, 0.85);

    for (let index = 0; index < 42; index += 1) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(20, Math.floor(height * 0.42));
      const size = Phaser.Math.Between(1, 3);
      stars.fillCircle(x, y, size);
    }

    stars.setDepth(0);
  }

  drawKingdomStructures() {
    const { width, height } = this.scale;

    this.drawCastle(width * 0.46, height * 0.43);
    this.drawHouse(width * 0.24, height * 0.58, 0x8b5e34);
    this.drawHouse(width * 0.74, height * 0.58, 0x4f6b88);
    this.drawHouse(width * 0.63, height * 0.32, 0x6f4d7c);
    this.drawTree(width * 0.1, height * 0.64, 1.25);
    this.drawTree(width * 0.84, height * 0.7, 1.4);
    this.drawTree(width * 0.17, height * 0.32, 1.0);
    this.drawTree(width * 0.78, height * 0.36, 1.1);
  }

  drawCastle(x, y) {
    const castle = this.add.container(x, y);

    const base = this.add.graphics();
    base.fillStyle(0x7f8ea6, 1);
    base.fillRoundedRect(-120, -80, 240, 170, 18);

    const keep = this.add.graphics();
    keep.fillStyle(0xaab6c7, 1);
    keep.fillRoundedRect(-48, -132, 96, 160, 16);
    keep.fillStyle(0xd5dce8, 1);
    keep.fillRoundedRect(-18, -162, 36, 40, 8);

    const roof = this.add.graphics();
    roof.fillStyle(0x3b2e4f, 1);
    roof.fillTriangle(-58, -132, 58, -132, 0, -182);

    const gate = this.add.graphics();
    gate.fillStyle(0x3b2f26, 1);
    gate.fillRoundedRect(-26, -8, 52, 88, 12);

    const banner = this.add.graphics();
    banner.fillStyle(0x60a5fa, 1);
    banner.fillRoundedRect(58, -118, 12, 52, 5);
    banner.fillStyle(0xe2e8f0, 1);
    banner.fillTriangle(70, -116, 118, -102, 70, -86);

    castle.add([base, keep, roof, gate, banner]);
    castle.setDepth(10);
  }

  drawHouse(x, y, color) {
    const house = this.add.container(x, y);

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.fillRoundedRect(-34, -24, 68, 48, 10);

    const roof = this.add.graphics();
    roof.fillStyle(0x43302c, 1);
    roof.fillTriangle(-42, -24, 42, -24, 0, -62);

    const door = this.add.graphics();
    door.fillStyle(0x271c14, 1);
    door.fillRoundedRect(-8, -2, 16, 26, 4);

    const windowLeft = this.add.graphics();
    windowLeft.fillStyle(0xe0f2fe, 0.95);
    windowLeft.fillRoundedRect(-24, -12, 12, 12, 3);

    const windowRight = this.add.graphics();
    windowRight.fillStyle(0xe0f2fe, 0.95);
    windowRight.fillRoundedRect(12, -12, 12, 12, 3);

    house.add([body, roof, door, windowLeft, windowRight]);
    house.setDepth(9);
  }

  drawTree(x, y, scale = 1) {
    const tree = this.add.container(x, y);

    const trunk = this.add.graphics();
    trunk.fillStyle(0x5a3e27, 1);
    trunk.fillRoundedRect(-5 * scale, 0, 10 * scale, 28 * scale, 3);

    const crown = this.add.graphics();
    crown.fillStyle(0x285430, 1);
    crown.fillCircle(0, -4 * scale, 16 * scale);
    crown.fillStyle(0x3f7d3b, 1);
    crown.fillCircle(-10 * scale, 2 * scale, 12 * scale);
    crown.fillCircle(10 * scale, 2 * scale, 12 * scale);
    crown.fillCircle(0, -16 * scale, 13 * scale);

    tree.add([trunk, crown]);
    tree.setDepth(8);
  }

  spawnPawns() {
    this.pawns = [];

    const routes = [
      {
        name: 'Mira',
        color: 0xf59e0b,
        route: [
          { x: 150, y: 530 },
          { x: 260, y: 470 },
          { x: 370, y: 510 },
          { x: 450, y: 420 },
          { x: 330, y: 360 },
        ],
      },
      {
        name: 'Toren',
        color: 0x38bdf8,
        route: [
          { x: 1020, y: 560 },
          { x: 930, y: 500 },
          { x: 860, y: 420 },
          { x: 790, y: 470 },
          { x: 900, y: 590 },
        ],
      },
      {
        name: 'Nora',
        color: 0x34d399,
        route: [
          { x: 640, y: 610 },
          { x: 560, y: 545 },
          { x: 500, y: 580 },
          { x: 520, y: 455 },
          { x: 610, y: 425 },
        ],
      },
      {
        name: 'Bram',
        color: 0xf472b6,
        route: [
          { x: 520, y: 320 },
          { x: 600, y: 360 },
          { x: 690, y: 320 },
          { x: 760, y: 390 },
          { x: 640, y: 450 },
        ],
      },
    ];

    routes.forEach((entry, index) => {
      const pawn = this.createPawn(entry.name, entry.color, entry.route[0].x, entry.route[0].y);
      pawn.setDepth(15 + index);
      this.pawns.push(pawn);
      this.runPawnRoute(pawn, entry.route, index * 450);
    });
  }

  createPawn(name, color, x, y) {
    const pawn = this.add.container(x, y);

    const shadow = this.add.ellipse(0, 14, 22, 8, 0x000000, 0.32);
    const body = this.add.circle(0, 0, 8, color, 1);
    const cloak = this.add.triangle(0, 6, -9, 6, 9, 6, 0, -10, 0xffffff, 0.9);
    cloak.setFillStyle(color, 1);
    const face = this.add.circle(0, -7, 3, 0xf8fafc, 1);
    const label = this.add.text(0, -24, name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#e2e8f0',
      backgroundColor: 'rgba(15, 23, 42, 0.5)',
      padding: { x: 4, y: 2 },
    });
    label.setOrigin(0.5);

    pawn.add([shadow, body, cloak, face, label]);
    return pawn;
  }

  runPawnRoute(pawn, route, initialDelay = 0) {
    const steps = route.map((point, index) => ({
      x: point.x,
      y: point.y,
      duration: 2200 + index * 120,
    }));

    const loopRoute = () => {
      this.tweens.timeline({
        targets: pawn,
        delay: initialDelay,
        tweens: steps.map((step, index) => ({
          x: step.x,
          y: step.y,
          duration: step.duration,
          ease: 'Sine.easeInOut',
          onStart: () => {
            pawn.setScale(1.05);
            pawn.list[2].setRotation(index % 2 === 0 ? 0.18 : -0.18);
          },
        })),
        onComplete: () => {
          pawn.setScale(1);
          pawn.list[2].setRotation(0);
          loopRoute();
        },
      });
    };

    loopRoute();
  }
}