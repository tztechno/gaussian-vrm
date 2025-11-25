// Virtual Controller for mobile devices
// Provides virtual joystick (left) and action buttons (right)

export class VirtualController {
  constructor() {
    this.enabled = false;
    this.container = null;
    this.mobileButton = null;

    // Joystick state
    this.joystick = {
      x: 0,
      y: 0,
      magnitude: 0,
      active: false
    };

    // Button states
    this.buttons = {
      cross: false,      // × - bottom (dash)
      circle: false,     // ○ - right (jab cross)
      triangle: false,   // △ - top (chicken dance)
      square: false      // □ - left (jump)
    };

    // Previous button states for edge detection
    this.previousButtons = {
      cross: false,
      circle: false,
      triangle: false,
      square: false
    };

    // Touch tracking
    this.joystickTouch = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.joystickRadius = 100;

    this._createMobileButton();
  }

  _createMobileButton() {
    // Create mobile mode button (similar to VR button in main.js)
    this.mobileButton = document.createElement('button');
    this.mobileButton.id = 'mobile-controller-button';
    this.mobileButton.textContent = 'Mobile';
    this.mobileButton.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: bold;
      color: white;
      background: rgba(0, 0, 0, 0.7);
      border: 2px solid white;
      border-radius: 8px;
      cursor: pointer;
      z-index: 1000;
      font-family: sans-serif;
    `;

    this.mobileButton.addEventListener('click', () => this.enable());
    document.body.appendChild(this.mobileButton);
  }

  enable() {
    if (this.enabled) return;
    this.enabled = true;

    // Hide the mobile button
    if (this.mobileButton) {
      this.mobileButton.style.display = 'none';
    }

    this._createUI();
    this._setupEventListeners();
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    // Show the mobile button
    if (this.mobileButton) {
      this.mobileButton.style.display = 'block';
    }

    this._removeUI();
  }

  _createUI() {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'virtual-controller';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999;
    `;

    // Create joystick area (left side)
    // Base circle: 240x240, margin from screen edge: 60px left, 60px bottom
    this.joystickArea = document.createElement('div');
    this.joystickArea.id = 'joystick-area';
    this.joystickArea.style.cssText = `
      position: absolute;
      bottom: 60px;
      left: 60px;
      width: 240px;
      height: 240px;
      pointer-events: auto;
      touch-action: none;
    `;

    // Joystick base
    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = `
      position: absolute;
      width: 240px;
      height: 240px;
      left: 0px;
      top: 0px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: 6px solid rgba(255, 255, 255, 0.5);
    `;

    // Joystick knob
    this.joystickKnob = document.createElement('div');
    this.joystickKnob.style.cssText = `
      position: absolute;
      width: 100px;
      height: 100px;
      left: 70px;
      top: 70px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.8);
      border: 4px solid white;
      transition: none;
    `;

    this.joystickArea.appendChild(this.joystickBase);
    this.joystickArea.appendChild(this.joystickKnob);

    // Create action buttons area (right side)
    // Diamond pattern: 4 buttons of 100x100, arranged in diamond
    // Total area: 280x280 (100 + 80 gap + 100 for horizontal/vertical)
    // Center position from right edge: 40 + 140 = 180px? No, let's match joystick center at 160px
    // To match: right edge margin = 160 - 140 = 20px... but joystick is 160px from left
    // Actually buttons diamond spans 280px, center at 140px from area edge
    // For center to be 160px from screen edge: margin = 160 - 140 = 20px
    // But joystick circle is 240px, center at 120px from area edge
    // Joystick center from screen: 40 + 120 = 160px
    // Button center from screen: margin + 140 = 160px => margin = 20px
    // But we want same visual margin. Let's use 40px margin for buttons too.
    // Button center from screen: 40 + 140 = 180px (different from joystick 160px)
    // To make centers align: button area 240x240, buttons at 70, 0, 140, 70
    this.buttonsArea = document.createElement('div');
    this.buttonsArea.id = 'buttons-area';
    this.buttonsArea.style.cssText = `
      position: absolute;
      bottom: 60px;
      right: 60px;
      width: 240px;
      height: 240px;
      pointer-events: auto;
      touch-action: none;
    `;

    // Create 4 action buttons in diamond pattern
    // Area is 240x240, center at 120,120
    // Buttons are 100x100, so center of button is at left+50, top+50
    // For button center to be at area center (120,120): left=70, top=70
    // Diamond offsets from center: 90px in each direction (80 + 10px extra spacing)
    // Triangle (top) - △: center at (120, 30) => left=70, top=-20
    this.triangleBtn = this._createActionButton('△', 70, -20, '#4CAF50');
    // Square (left) - □ (jump - purple): center at (30, 120) => left=-20, top=70
    this.squareBtn = this._createActionButton('□', -20, 70, '#9C27B0');
    // Circle (right) - ○: center at (210, 120) => left=160, top=70
    this.circleBtn = this._createActionButton('○', 160, 70, '#F44336');
    // Cross (bottom) - × (dash - blue): center at (120, 210) => left=70, top=160
    this.crossBtn = this._createActionButton('×', 70, 160, '#2196F3');

    this.buttonsArea.appendChild(this.triangleBtn);
    this.buttonsArea.appendChild(this.squareBtn);
    this.buttonsArea.appendChild(this.circleBtn);
    this.buttonsArea.appendChild(this.crossBtn);

    // Create PC button to exit mobile mode (centered at bottom)
    this.pcButton = document.createElement('button');
    this.pcButton.id = 'pc-mode-button';
    this.pcButton.textContent = 'PC';
    this.pcButton.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      font-size: 16px;
      font-weight: normal;
      color: white;
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid white;
      border-radius: 8px;
      cursor: pointer;
      pointer-events: auto;
      font-family: sans-serif;
    `;
    this.pcButton.addEventListener('click', () => this.disable());

    this.container.appendChild(this.joystickArea);
    this.container.appendChild(this.buttonsArea);
    this.container.appendChild(this.pcButton);
    document.body.appendChild(this.container);
  }

  _createActionButton(symbol, left, top, color) {
    const btn = document.createElement('div');
    btn.style.cssText = `
      position: absolute;
      width: 100px;
      height: 100px;
      left: ${left}px;
      top: ${top}px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      border: 6px solid ${color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: bold;
      color: ${color};
      user-select: none;
      touch-action: none;
    `;
    btn.textContent = symbol;
    btn.dataset.symbol = symbol;
    return btn;
  }

  _removeUI() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  _setupEventListeners() {
    // Joystick touch events
    this.joystickArea.addEventListener('touchstart', (e) => this._onJoystickStart(e));
    this.joystickArea.addEventListener('touchmove', (e) => this._onJoystickMove(e));
    this.joystickArea.addEventListener('touchend', (e) => this._onJoystickEnd(e));
    this.joystickArea.addEventListener('touchcancel', (e) => this._onJoystickEnd(e));

    // Button touch events
    this._setupButtonEvents(this.triangleBtn, 'triangle');
    this._setupButtonEvents(this.squareBtn, 'square');
    this._setupButtonEvents(this.circleBtn, 'circle');
    this._setupButtonEvents(this.crossBtn, 'cross');
  }

  _setupButtonEvents(btn, name) {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.buttons[name] = true;
      btn.style.background = 'rgba(255, 255, 255, 0.5)';
      btn.style.transform = 'scale(0.9)';
    });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.buttons[name] = false;
      btn.style.background = 'rgba(0, 0, 0, 0.5)';
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.buttons[name] = false;
      btn.style.background = 'rgba(0, 0, 0, 0.5)';
      btn.style.transform = 'scale(1)';
    });
  }

  _onJoystickStart(e) {
    e.preventDefault();
    if (this.joystickTouch !== null) return;

    const touch = e.changedTouches[0];
    this.joystickTouch = touch.identifier;

    const rect = this.joystickArea.getBoundingClientRect();
    this.joystickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    this._updateJoystickPosition(touch.clientX, touch.clientY);
    this.joystick.active = true;
  }

  _onJoystickMove(e) {
    e.preventDefault();
    if (this.joystickTouch === null) return;

    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouch) {
        this._updateJoystickPosition(touch.clientX, touch.clientY);
        break;
      }
    }
  }

  _onJoystickEnd(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.joystickTouch) {
        this.joystickTouch = null;
        this.joystick.x = 0;
        this.joystick.y = 0;
        this.joystick.magnitude = 0;
        this.joystick.active = false;

        // Reset knob position (center of 240px area, knob is 100px)
        this.joystickKnob.style.left = '70px';
        this.joystickKnob.style.top = '70px';
        break;
      }
    }
  }

  _updateJoystickPosition(touchX, touchY) {
    const dx = touchX - this.joystickCenter.x;
    const dy = touchY - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = this.joystickRadius;

    let normX = dx / maxDistance;
    let normY = dy / maxDistance;

    // Clamp to circle
    if (distance > maxDistance) {
      normX = (dx / distance);
      normY = (dy / distance);
    }

    this.joystick.x = Math.max(-1, Math.min(1, normX));
    this.joystick.y = Math.max(-1, Math.min(1, normY));
    this.joystick.magnitude = Math.min(1, distance / maxDistance);

    // Update knob visual position (center at 70px, max movement 70px)
    const knobX = 70 + (this.joystick.x * 70);
    const knobY = 70 + (this.joystick.y * 70);
    this.joystickKnob.style.left = `${knobX}px`;
    this.joystickKnob.style.top = `${knobY}px`;
  }

  // Get input state in the same format as gamepad
  getInput() {
    const result = {
      x: this.joystick.x,
      y: this.joystick.y,
      magnitude: this.joystick.magnitude,
      crossButton: this.buttons.cross,
      circleButton: this.buttons.circle,
      triangleButton: this.buttons.triangle,
      squareButton: this.buttons.square
    };

    return result;
  }

  // Update previous button states (call at end of frame)
  updatePreviousState() {
    this.previousButtons.cross = this.buttons.cross;
    this.previousButtons.circle = this.buttons.circle;
    this.previousButtons.triangle = this.buttons.triangle;
    this.previousButtons.square = this.buttons.square;
  }

  // Check if button was just pressed (edge detection)
  wasButtonJustPressed(buttonName) {
    return this.buttons[buttonName] && !this.previousButtons[buttonName];
  }
}
