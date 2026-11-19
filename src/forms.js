// A tiny modal form builder on top of <dialog>.
import { icon, VALUE_ICONS } from './icons.js';

export const COLORS = ['#e0a43a', '#d9775b', '#c9697f', '#5fae8a', '#5b8fd6', '#6bb3c4', '#a58fd6', '#a3a9b8'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function field(f, v) {
  const id = `f-${f.name}`;
  const hint = f.hint ? `<p class="hint">${esc(f.hint)}</p>` : '';
  switch (f.type) {
    case 'textarea':
      return `<label class="field" for="${id}"><span>${f.label}</span><textarea id="${id}" name="${f.name}" rows="3">${esc(v)}</textarea>${hint}</label>`;
    case 'checkbox':
      return `<label class="field check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}><span>${f.label}</span></label>${hint}`;
    case 'select':
      return `<label class="field" for="${id}"><span>${f.label}</span><select id="${id}" name="${f.name}">${f.options
        .map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>${hint}</label>`;
    case 'swatch':
      return `<fieldset class="field"><legend>${f.label}</legend><div class="swatches">${COLORS.map((c) =>
        `<label class="swatch" style="--c:${c}"><input type="radio" name="${f.name}" value="${c}" ${c === v ? 'checked' : ''}><i></i></label>`).join('')}</div></fieldset>`;
    case 'icon':
      return `<fieldset class="field"><legend>${f.label}</legend><div class="icon-grid">${VALUE_ICONS.map((n) =>
        `<label class="icon-opt"><input type="radio" name="${f.name}" value="${n}" ${n === v ? 'checked' : ''}>${icon(n, 18)}</label>`).join('')}</div></fieldset>`;
    default:
      return `<label class="field" for="${id}"><span>${f.label}</span><input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}"
        ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''}
        ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} autocomplete="off">${hint}</label>`;
  }
}

/**
 * openForm({ title, fields, values, submitLabel, onSubmit(data), onDelete?, deleteLabel? })
 */
export function openForm({ title, fields, values = {}, submitLabel = 'Save', onSubmit, onDelete, deleteLabel = 'Delete', note }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet-dialog';
  dlg.innerHTML = `<form method="dialog" class="form">
    <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></header>
    ${note ? `<p class="hint">${esc(note)}</p>` : ''}
    <div class="fields">${fields.map((f) => field(f, values[f.name] ?? f.default ?? '')).join('')}</div>
    <footer>
      ${onDelete ? `<button type="button" class="btn danger" data-del>${deleteLabel}</button>` : '<span></span>'}
      <span class="spacer"></span>
      <button type="button" class="btn" data-close>Cancel</button>
      <button type="submit" class="btn primary">${esc(submitLabel)}</button>
    </footer></form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  const del = dlg.querySelector('[data-del]');
  if (del) {
    del.addEventListener('click', () => {
      if (!del.dataset.armed) {
        del.dataset.armed = '1';
        del.textContent = 'Click again to confirm';
        return;
      }
      onDelete();
      close();
    });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    for (const f of fields) {
      const el = form.elements[f.name];
      if (f.type === 'checkbox') data[f.name] = el.checked;
      else if (f.type === 'number') data[f.name] = Number(el.value);
      else data[f.name] = (el.value ?? '').trim();
    }
    onSubmit(data);
    close();
  });
  dlg.showModal();
  const first = form.querySelector('input[type=text],input[type=number],textarea');
  if (first) first.focus();
}

/** Simple confirm dialog. */
export function confirmBox({ title, text, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'sheet-dialog small';
  dlg.innerHTML = `<form method="dialog" class="form"><header><h2>${esc(title)}</h2></header>
    <p class="hint">${esc(text)}</p>
    <footer><span class="spacer"></span><button type="button" class="btn" data-close>Cancel</button>
    <button type="button" class="btn ${danger ? 'danger solid' : 'primary'}" data-ok>${esc(confirmLabel)}</button></footer></form>`;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('[data-close]').addEventListener('click', close);
  dlg.querySelector('[data-ok]').addEventListener('click', () => { onConfirm(); close(); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.showModal();
}
