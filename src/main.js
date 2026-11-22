import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles.css';
import { init, joinSync } from './ui.js';
import { start } from './sync.js';

// A sync link looks like .../#k=<code>. Take the code and clean the address bar.
const m = location.hash.match(/^#k=([A-Za-z0-9_-]+)/);
if (m) history.replaceState(null, '', location.pathname + location.search + '#/today');

init();
start();
if (m) joinSync(m[1]);
