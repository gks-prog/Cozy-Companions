const pet = document.querySelector('#pet');
const pixelCanvas = document.querySelector('#pixel-pet');
const classicPet = document.querySelector('#classic-pet');
const wrap = document.querySelector('#pet-wrap');
const chooser = document.querySelector('#chooser');
const customizer = document.querySelector('#customizer');
const customizerForm = document.querySelector('#customizer-form');
const starterName = document.querySelector('#starter-name');
const petNameInput = document.querySelector('#pet-name');
const patternInput = document.querySelector('#pet-pattern');
const baseColorInput = document.querySelector('#base-color');
const patchColorInput = document.querySelector('#patch-color');
const eyeColorInput = document.querySelector('#eye-color');
const paletteField = document.querySelector('.palette-field');
const thought = document.querySelector('#thought');
const heart = document.querySelector('#heart');
const bond = document.querySelector('#bond');
const bondValue = document.querySelector('#bond-value');

const classicCells = {
  puppy: { idle:[0,0], blink:[1,0], look:[3,0], happy:[2,1], startled:[0,2], sleep:[1,2], pounce:[0,3], groom:[2,3], drag:[3,3], typing:[0,3] },
  kitten: { idle:[0,0], blink:[1,0], look:[2,0], happy:[1,1], startled:[3,1], sleep:[0,2], pounce:[3,2], groom:[0,3], drag:[1,3], typing:[3,2] }
};

let profile = {
  pet:'kitten', petName:'Mochi', style:'pixel', pattern:'mask',
  baseColor:'#f4eadb', patchColor:'#9b6548', eyeColor:'#d89b35',
  affection:50, reactionsPaused:false
};
let draft = { ...profile };
let idleTimer;
let personalityTimer;
let stateTimer;
let messageTimer;
let typingWindow = [];
let typingSide = 'right';
let drag = null;
let hoverInside = false;
let lastCursor = null;
let strokeDistance = 0;
let strokeDirection = 0;
let strokes = 0;
let lastPounce = 0;

const pixelRenderer = new window.PixelPet(pixelCanvas, profile);
pixelRenderer.start();

document.querySelectorAll('.choice-canvas').forEach(canvas => {
  const preview = new window.PixelPet(canvas, {
    pet:canvas.dataset.preview, pattern:'mask', baseColor:'#f4eadb',
    patchColor:'#9b6548', eyeColor:'#d89b35'
  });
  preview.draw();
});

function safeName(value, kind = profile.pet) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 18) || (kind === 'kitten' ? 'Mochi' : 'Milo');
}

function setClassicCell(name) {
  const kind = classicCells[profile.pet] ? profile.pet : 'kitten';
  const [column, row] = classicCells[kind][name] || classicCells[kind].idle;
  classicPet.style.backgroundPosition = `${column * 33.333333}% ${row * 33.333333}%`;
}

function applyProfile(next) {
  profile = { ...profile, ...next };
  profile.petName = safeName(profile.petName, profile.pet);
  pet.className = `pet ${profile.style === 'classic' ? 'classic' : 'pixel'} ${profile.pet}`;
  pet.setAttribute('aria-label', `Pet ${profile.petName}`);
  pixelRenderer.setProfile(profile);
  bond.value = Number(profile.affection) || 0;
  bondValue.textContent = `${Math.round(bond.value)}%`;
  setState('idle');
}

function setState(name, duration = 0, detail = {}) {
  if (profile.reactionsPaused && name !== 'idle') return;
  clearTimeout(stateTimer);
  pet.classList.remove('typing','happy','startled','sleeping','dragging');
  pixelRenderer.setState(name, detail);
  setClassicCell(name);
  if (name === 'typing') pet.classList.add('typing');
  if (name === 'happy') pet.classList.add('happy');
  if (name === 'startled') pet.classList.add('startled');
  if (name === 'sleep') pet.classList.add('sleeping');
  if (name === 'drag') pet.classList.add('dragging');
  if (duration) stateTimer = setTimeout(() => setState('idle'), duration);
}

function showThought(text, duration = 1300) {
  clearTimeout(messageTimer);
  thought.textContent = text;
  thought.classList.add('show');
  messageTimer = setTimeout(() => thought.classList.remove('show'), duration);
}

function popHeart() {
  heart.classList.remove('pop');
  void heart.offsetWidth;
  heart.classList.add('pop');
}

async function choose(kind) {
  const next = await window.petAPI.updateProfile({
    pet:kind, petName:safeName(starterName.value, kind), style:'pixel',
    pattern:'mask', baseColor:'#f4eadb', patchColor:'#9b6548', eyeColor:'#d89b35'
  });
  applyProfile(next);
  chooser.classList.add('hidden');
  wrap.classList.remove('hidden');
  window.petAPI.setClickThrough(true);
  setState('happy', 750);
  showThought(`${profile.petName} is home! ♥`, 1600);
}

document.querySelectorAll('.choice').forEach(button => {
  button.addEventListener('click', () => choose(button.dataset.pet));
});

function markActive(selector, key) {
  document.querySelectorAll(selector).forEach(button => {
    const value = button.dataset.kind || button.dataset.style;
    button.classList.toggle('active', value === key);
  });
}

function refreshCustomizer() {
  petNameInput.value = profile.petName;
  draft = { ...profile };
  patternInput.value = draft.pattern || 'mask';
  baseColorInput.value = draft.baseColor || '#f4eadb';
  patchColorInput.value = draft.patchColor || '#9b6548';
  eyeColorInput.value = draft.eyeColor || '#d89b35';
  markActive('[data-kind]', draft.pet);
  markActive('[data-style]', draft.style);
  paletteField.classList.toggle('disabled', draft.style === 'classic');
  bond.value = Number(profile.affection) || 0;
  bondValue.textContent = `${Math.round(bond.value)}%`;
}

function openCustomizer() {
  refreshCustomizer();
  wrap.classList.add('hidden');
  chooser.classList.add('hidden');
  customizer.classList.remove('hidden');
  window.petAPI.setClickThrough(false);
  setTimeout(() => petNameInput.focus(), 50);
}

function closeCustomizer() {
  customizer.classList.add('hidden');
  wrap.classList.remove('hidden');
  window.petAPI.setClickThrough(true);
}

document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  draft.pet = button.dataset.kind;
  markActive('[data-kind]', draft.pet);
}));

document.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => {
  draft.style = button.dataset.style;
  markActive('[data-style]', draft.style);
  paletteField.classList.toggle('disabled', draft.style === 'classic');
}));

customizerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const next = await window.petAPI.updateProfile({
    ...draft,
    petName:safeName(petNameInput.value, draft.pet),
    pattern:patternInput.value,
    baseColor:baseColorInput.value,
    patchColor:patchColorInput.value,
    eyeColor:eyeColorInput.value
  });
  applyProfile(next);
  closeCustomizer();
  setState('happy', 700);
  showThought(`I’m ${profile.petName}!`, 1400);
});

document.querySelector('#cancel-customizer').addEventListener('click', closeCustomizer);

pet.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  pet.setPointerCapture(event.pointerId);
  drag = {
    pointerId:event.pointerId, startScreenX:event.screenX, startScreenY:event.screenY,
    windowX:event.screenX - event.clientX, windowY:event.screenY - event.clientY, moved:false
  };
});

pet.addEventListener('pointermove', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = event.screenX - drag.startScreenX;
  const dy = event.screenY - drag.startScreenY;
  if (!drag.moved && Math.hypot(dx,dy) > 6) {
    drag.moved = true;
    setState('drag');
  }
  if (drag.moved) {
    window.petAPI.moveWindow({
      x:event.screenX - (drag.startScreenX - drag.windowX),
      y:event.screenY - (drag.startScreenY - drag.windowY)
    });
  }
});

function finishPointer(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  try { pet.releasePointerCapture(event.pointerId); } catch {}
  if (drag.moved) {
    setState('happy', 600);
    showThought('I like this spot!', 1000);
  } else {
    setState('happy', 700);
    popHeart();
    window.petAPI.addAffection(1);
    profile.affection = Math.min(100, Number(profile.affection) + 1);
  }
  drag = null;
}

pet.addEventListener('pointerup', finishPointer);
pet.addEventListener('pointercancel', finishPointer);
pet.addEventListener('dblclick', openCustomizer);
pet.addEventListener('contextmenu', event => {
  event.preventDefault();
  window.petAPI.showMenu();
});
pet.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    setState('happy', 700);
    popHeart();
    window.petAPI.addAffection(1);
  }
});

window.petAPI.onCursor(position => {
  const panelOpen = !customizer.classList.contains('hidden') || !chooser.classList.contains('hidden');
  if (panelOpen) { lastCursor = position; return; }

  const dx = position.x - 160;
  const dy = position.y - 160;
  const distance = Math.hypot(dx,dy);
  const inside = distance < 105;

  if (inside !== hoverInside) {
    hoverInside = inside;
    window.petAPI.setClickThrough(!inside);
  }

  if (!drag && !profile.reactionsPaused) {
    pixelRenderer.setGaze(dx / 35, dy / 55);
    pet.style.setProperty('--cursor-tilt', `${Math.max(-3, Math.min(3, dx / 45))}deg`);
    if (distance < 170 && !pet.classList.contains('typing') && !pet.classList.contains('happy')) {
      pixelRenderer.setState('look');
      setClassicCell('look');
    }
  }

  if (lastCursor && !drag) {
    const stepX = position.screenX - lastCursor.screenX;
    const stepY = position.screenY - lastCursor.screenY;
    const speed = Math.hypot(stepX,stepY);
    if (inside && speed > 1 && speed < 26) {
      strokeDistance += speed;
      const direction = Math.sign(stepX);
      if (direction && strokeDirection && direction !== strokeDirection) strokes += 1;
      if (direction) strokeDirection = direction;
      if (strokeDistance > 135 && strokes >= 3) {
        setState('happy', 850); popHeart(); window.petAPI.addAffection(2);
        profile.affection = Math.min(100, Number(profile.affection) + 2);
        strokeDistance = 0; strokes = 0;
      }
    } else if (distance < 175 && speed > 34 && Date.now() - lastPounce > 2600) {
      lastPounce = Date.now();
      setState('pounce', 700);
      showThought(profile.pet === 'kitten' ? 'Got it!' : 'Catch!', 800);
    }
  }
  lastCursor = position;
  resetIdleTimer();
});

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!drag && !profile.reactionsPaused) {
      setState('sleep');
      showThought('z z z', 2600);
    }
  }, 1000 * 60 * 4);
}

function schedulePersonalityMoment() {
  clearTimeout(personalityTimer);
  personalityTimer = setTimeout(() => {
    if (!drag && !profile.reactionsPaused && customizer.classList.contains('hidden') && chooser.classList.contains('hidden')) {
      const moments = [
        () => setState('blink', 360),
        () => setState('groom', 1000),
        () => setState('pounce', 800),
        () => showThought(profile.pet === 'puppy' ? 'Play?' : 'Purr…', 1000)
      ];
      moments[Math.floor(Math.random() * moments.length)]();
    }
    schedulePersonalityMoment();
  }, 11000 + Math.random() * 15000);
}

window.petAPI.onTyping(detail => {
  if (profile.reactionsPaused || drag) return;
  typingSide = detail?.side || (typingSide === 'left' ? 'right' : 'left');
  const now = Date.now();
  typingWindow.push(now);
  typingWindow = typingWindow.filter(time => now - time < 1300);
  setState('typing', 220, { side:typingSide });
  if (typingWindow.length >= 10) {
    showThought(profile.pet === 'puppy' ? `${profile.petName} believes in you!` : `${profile.petName} is helping…`, 1350);
    typingWindow = [];
  }
  resetIdleTimer();
});

window.petAPI.onReminder(reminder => {
  setState('happy', 900);
  const messages = {
    focus:'Focus session complete — nice work!',
    water:'Water break?',
    stretch:'Time for a tiny stretch!'
  };
  showThought(messages[reminder] || reminder, 3200);
});

window.petAPI.onWake(() => {
  setState('happy', 900);
  showThought(`${profile.petName} missed you! ♥`, 1600);
});
window.petAPI.onSelectPet(next => {
  applyProfile(next);
  customizer.classList.add('hidden'); chooser.classList.add('hidden'); wrap.classList.remove('hidden');
  setState('happy', 750);
});
window.petAPI.onOpenSelector(() => {
  starterName.value = profile.petName;
  wrap.classList.add('hidden'); customizer.classList.add('hidden'); chooser.classList.remove('hidden');
  window.petAPI.setClickThrough(false);
});
window.petAPI.onOpenSettings(openCustomizer);
window.petAPI.onSettings(next => applyProfile(next));

window.petAPI.getSettings().then(current => {
  applyProfile(current);
  if (current.pet === 'puppy' || current.pet === 'kitten') {
    wrap.classList.remove('hidden');
    window.petAPI.setClickThrough(true);
  } else {
    starterName.value = '';
    chooser.classList.remove('hidden');
    window.petAPI.setClickThrough(false);
  }
  resetIdleTimer();
  schedulePersonalityMoment();
});

