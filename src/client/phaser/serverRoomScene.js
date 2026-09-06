import Phaser from 'phaser';

export class ServerRoomScene extends Phaser.Scene {
  constructor() {
    super('ServerRoomScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#08111f');
    this.drawGrid();

    const title = this.add.text(24, 24, 'Server Room', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#9be7ff',
    });

    title.setDepth(2);
  }

  drawGrid() {
    const { width, height } = this.scale;
    const graphics = this.add.graphics();

    graphics.lineStyle(1, 0x1f3b58, 0.8);

    const cellSize = 48;

    for (let x = 0; x <= width; x += cellSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += cellSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }

    graphics.strokePath();

    graphics.fillStyle(0x0d1c2d, 0.35);
    for (let y = 0; y < height; y += cellSize * 2) {
      for (let x = 0; x < width; x += cellSize * 2) {
        graphics.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      }
    }

    graphics.setDepth(0);
  }
}