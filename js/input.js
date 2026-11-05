import { clamp } from './util.js';

const KEY_ACTIONS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump',
  KeyX: 'punch', KeyJ: 'punch', KeyK: 'punch',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.keyAxis = 0;
    this.touchAxis = 0;
    this.axis = 0;
    this.touchDevice = false;
    this.anyInput = false;
    this.joystick = { active: false, pointerId: null, cx: 0, cy: 0, radius: 1, x: 0, y: 0 };
    this.gamepadPrev = {};
    this._bindKeyboard();
    this._detectTouch();
  }

  _detectTouch() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.touchDevice = coarse || (navigator.maxTouchPoints || 0) > 0;
    const onTouch = () => {
      this.touchDevice = true;
      document.getElementById('app')?.classList.add('touch-device');
    };
    window.addEventListener('touchstart', onTouch, { passive: true, once: true });
    if (this.touchDevice) document.getElementById('app')?.classList.add('touch-device');
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action) return;
      if (e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName)) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.anyInput = true;
      if (!this.down.has(action)) this.pressed.add(action);
      this.down.add(action);
      if (action === 'left' || action === 'right') this._recomputeKeyAxis();
    });
    window.addEventListener('keyup', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (!action) return;
      this.down.delete(action);
      this.released.add(action);
      if (action === 'left' || action === 'right') this._recomputeKeyAxis();
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.keyAxis = 0;
      this.resetJoystick();
    });
  }

  _recomputeKeyAxis() {
    const l = this.down.has('left') ? 1 : 0;
    const r = this.down.has('right') ? 1 : 0;
    this.keyAxis = r - l;
  }

  attachTouchUI() {
    const app = document.getElementById('app');
    const stick = document.getElementById('joystick-stick');
    const joy = document.getElementById('joystick');
    if (joy) {
      const update = (e) => {
        const r = joy.getBoundingClientRect();
        const j = this.joystick;
        j.cx = r.left + r.width / 2;
        j.cy = r.top + r.height / 2;
        j.radius = r.width * 0.34;
        const dx = e.clientX - j.cx;
        const dy = e.clientY - j.cy;
        const len = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(len, j.radius);
        const nx = (dx / len) * clamped;
        const ny = (dy / len) * clamped;
        j.x = nx / j.radius;
        j.y = ny / j.radius;
        this.touchAxis = clamp(j.x * 1.25, -1, 1);
        if (Math.abs(this.touchAxis) < 0.16) this.touchAxis = 0;
        if (stick) stick.style.transform = `translate(${nx}px, ${ny}px)`;
      };
      joy.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!app.classList.contains('touch-device')) app.classList.add('touch-device');
        this.anyInput = true;
        this.joystick.active = true;
        this.joystick.pointerId = e.pointerId;
        joy.setPointerCapture?.(e.pointerId);
        update(e);
      });
      joy.addEventListener('pointermove', (e) => {
        if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
        e.preventDefault();
        update(e);
      });
      const end = (e) => {
        if (e.pointerId !== this.joystick.pointerId) return;
        this.resetJoystick();
      };
      joy.addEventListener('pointerup', end);
      joy.addEventListener('pointercancel', end);
      joy.addEventListener('lostpointercapture', end);
    }

    const bindButton = (id, action) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.anyInput = true;
        el.setPointerCapture?.(e.pointerId);
        el.classList.add('is-down');
        if (!this.down.has(action)) this.pressed.add(action);
        this.down.add(action);
      });
      const up = (e) => {
        e.preventDefault();
        el.classList.remove('is-down');
        this.down.delete(action);
        this.released.add(action);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindButton('btn-jump', 'jump');
    bindButton('btn-punch', 'punch');
  }

  resetJoystick() {
    this.joystick.active = false;
    this.joystick.pointerId = null;
    this.joystick.x = 0;
    this.joystick.y = 0;
    this.touchAxis = 0;
    const stick = document.getElementById('joystick-stick');
    if (stick) stick.style.transform = 'translate(0px, 0px)';
  }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.2) this.keyAxis = clamp(ax * 1.15, -1, 1);
      else if (!this.down.has('left') && !this.down.has('right')) this.keyAxis = 0;
      const map = { 0: 'jump', 2: 'punch', 9: 'pause', 8: 'mute' };
      for (const [idx, action] of Object.entries(map)) {
        const b = pad.buttons[idx];
        const isDown = !!(b && (b.pressed || b.value > 0.4));
        const was = this.gamepadPrev[action] || false;
        if (isDown && !was) {
          this.pressed.add(action);
          this.anyInput = true;
        }
        if (isDown) this.down.add(action); else this.down.delete(action);
        this.gamepadPrev[action] = isDown;
      }
    }
    this.axis = clamp(this.keyAxis + this.touchAxis, -1, 1);
    if (Math.abs(this.axis) < 0.06) this.axis = 0;
  }

  update() {
    this.pollGamepad();
  }

  isDown(action) { return this.down.has(action); }
  wasPressed(action) { return this.pressed.has(action); }
  clearFrame() {
    this.pressed.clear();
    this.released.clear();
  }
}
