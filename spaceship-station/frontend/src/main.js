import ShipScene from './scenes/ShipScene.js';

const gameContainer = document.getElementById('game-shell');

const config = {
  type: Phaser.AUTO,
  parent: 'game-shell',
  width: gameContainer.clientWidth,
  height: gameContainer.clientHeight,
  backgroundColor: '#050b11',
  scene: [ShipScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  if (game && game.scale) {
    const container = document.getElementById('game-shell');
    game.scale.resize(container.clientWidth, container.clientHeight);
  }
});
