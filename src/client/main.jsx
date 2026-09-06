import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Phaser from 'phaser';

import { HudOverlay } from './components/HudOverlay.jsx';
import { ServerRoomScene } from './phaser/serverRoomScene.js';
import './styles/tailwind.css';

function ClientShell() {
  const phaserContainerRef = useRef(null);

  useEffect(() => {
    if (!phaserContainerRef.current) {
      return undefined;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: phaserContainerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#08111f',
      scene: [ServerRoomScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950">
      <div ref={phaserContainerRef} className="absolute inset-0" />
      <HudOverlay />
    </div>
  );
}

const rootElement = document.getElementById('app');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ClientShell />
    </React.StrictMode>,
  );
}