import './ui/styles.css';
import { MemoryStorage, type Storage } from './core/save';
import { loadAssets } from './render/placeholders';
import { App } from './ui/app';

function pickStorage(): Storage {
  try {
    const k = '__omt_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    console.warn('localStorage unavailable; progress will not be saved.');
    return new MemoryStorage();
  }
}

async function boot() {
  const root = document.getElementById('app')!;
  await loadAssets();
  const app = new App(root, pickStorage());
  // Exposed for debugging and automated tests.
  (window as unknown as { __omt: App }).__omt = app;
  app.go({ name: 'title' });
}

boot().catch((e) => {
  console.error(e);
  const root = document.getElementById('app');
  if (root) root.textContent = `Something went wrong while starting the game: ${String(e)}`;
});
