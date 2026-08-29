import ShipScene from './scenes/ShipScene.js';

// Fixed logical resolution keeps the hull layout consistent; FIT scales it to the container.
const config = {
  type: Phaser.AUTO,
  parent: 'game-shell',
  width: 1600,
  height: 900,
  backgroundColor: '#0b0414',
  scene: [ShipScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
