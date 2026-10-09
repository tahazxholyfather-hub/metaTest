import { CANVAS_W, CANVAS_H, meters } from './utils.js';
import { TOOL_IDS, TOOL_META } from './tools.js';

export class UI {
  constructor(overlayEl) {
    this.el = overlayEl;
    this.restPanel = null;
    this.continueMsg = null;
    this._build();
  }

  _build() {
    this.el.innerHTML = `
      <div id="hud-distance"></div>
      <div id="hud-tools"></div>
      <div id="hud-hint"></div>
      <div id="rest-panel" class="hidden">
        <p class="rest-title">Rest</p>
        <p id="rest-distance"></p>
        <p id="rest-continue" class="hidden">Press E or any key to continue</p>
      </div>
      <div id="death-msg" class="hidden"></div>
      <div id="title-screen">
        <h1>Drift</h1>
        <p>Endless Atmospheric Adventure</p>
        <p class="controls">← → brake / speed · Space jump · 1–4 tools · E at campfire</p>
        <p class="start">Press Enter or click to begin</p>
      </div>
    `;
    this.distEl = this.el.querySelector('#hud-distance');
    this.toolsEl = this.el.querySelector('#hud-tools');
    this.hintEl = this.el.querySelector('#hud-hint');
    this.restPanel = this.el.querySelector('#rest-panel');
    this.restDist = this.el.querySelector('#rest-distance');
    this.continueMsg = this.el.querySelector('#rest-continue');
    this.deathMsg = this.el.querySelector('#death-msg');
    this.titleScreen = this.el.querySelector('#title-screen');
  }

  hideTitle() {
    this.titleScreen?.classList.add('hidden');
  }

  updateDistance(px, record) {
    const m = Math.floor(meters(px));
    this.distEl.textContent = `${m} m`;
    if (record > 0) this.distEl.title = `Record: ${Math.floor(record)} m`;
  }

  updateTools(tools) {
    let html = '';
    for (const id of TOOL_IDS) {
      const n = tools.slots[id] || 0;
      const active = tools.active === id || (id === 'light' && tools.lightActive());
      if (n > 0 || (id === 'light' && tools.lightTimer > 0)) {
        const uses = id === 'light' && tools.lightTimer > 0
          ? Math.ceil(tools.lightTimer)
          : n;
        html += `<span class="tool ${active ? 'active' : ''}" title="${TOOL_META[id].name}">${TOOL_META[id].key}: ${uses}</span>`;
      }
    }
    this.toolsEl.innerHTML = html;
  }

  showRest(distM, canContinue) {
    this.restPanel.classList.remove('hidden');
    this.restDist.textContent = `Checkpoint: ${Math.floor(distM)} m`;
    if (canContinue) this.continueMsg.classList.remove('hidden');
    else this.continueMsg.classList.add('hidden');
  }

  hideRest() {
    this.restPanel.classList.add('hidden');
    this.continueMsg.classList.add('hidden');
  }

  showDeathContinue(distM) {
    this.deathMsg.classList.remove('hidden');
    this.deathMsg.textContent = `Continue from ${Math.floor(distM)} m…`;
  }

  hideDeath() {
    this.deathMsg.classList.add('hidden');
  }

  setHint(text) {
    this.hintEl.textContent = text || '';
  }
}
