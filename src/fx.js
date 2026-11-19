// Feedback effects: floating XP, toasts, and the reward reveal.
import { icon } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function xpPopup(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'xp-pop';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (color) el.style.setProperty('--c', color);
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

export function toast(text) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 2800);
}

export const pips = (n, total = 5) =>
  `<span class="pips" role="img" aria-label="Rating ${n} of ${total}">${Array.from({ length: total }, (_, i) =>
    `<i class="${i < n ? 'on' : ''}" style="--i:${i}"></i>`).join('')}</span>`;

const RARITY = ['', 'Trifle', 'Small treat', 'Good find', 'Rare', 'Grand prize'];
export const rarityName = (n) => RARITY[n] || '';

/**
 * Gacha-style reveal. A sealed card, tap to open, rays, flip, claim.
 * onClaim() is called once; onClose() always when the overlay goes away.
 */
export function showReveal({ days, reward, onClaim, onClose }) {
  const el = document.createElement('div');
  el.className = 'reveal';
  el.dataset.rating = reward.rating;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `Day ${days} reward`);
  el.innerHTML = `
    <div class="reveal-glow"></div>
    <div class="reveal-stage">
      <div class="rays"></div>
      <div class="card3d">
        <div class="face back"><div class="seal">${icon('gift', 40)}</div><span>Day ${days}</span></div>
        <div class="face front">
          <span class="rar">${rarityName(reward.rating)}</span>
          ${pips(reward.rating)}
          <h3>${esc(reward.title)}</h3>
          ${reward.description ? `<p>${esc(reward.description)}</p>` : ''}
          ${reward.link ? `<a href="${esc(reward.link)}" target="_blank" rel="noopener noreferrer">${icon('link', 14)} Open link</a>` : ''}
        </div>
      </div>
    </div>
    <p class="reveal-kicker">${days}-day streak reached</p>
    <div class="reveal-actions">
      <button class="btn primary big" data-open>Open</button>
      <button class="btn big" data-later>Later</button>
    </div>`;
  document.body.appendChild(el);
  const actions = el.querySelector('.reveal-actions');
  const done = () => { el.classList.add('leaving'); setTimeout(() => { el.remove(); onClose && onClose(); }, 200); };
  el.querySelector('[data-open]').addEventListener('click', () => {
    el.classList.add('opened');
    actions.innerHTML = `<button class="btn primary big" data-claim>Claim</button>`;
    actions.querySelector('[data-claim]').addEventListener('click', () => {
      onClaim();
      toast(`Claimed: ${reward.title}`);
      done();
    });
    actions.querySelector('[data-claim]').focus();
  });
  el.querySelector('[data-later]').addEventListener('click', done);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(); });
  el.querySelector('[data-open]').focus();
}
