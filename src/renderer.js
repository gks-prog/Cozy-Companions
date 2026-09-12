const pet = document.querySelector('#pet');
const wrap = document.querySelector('#pet-wrap');
const chooser = document.querySelector('#chooser');
const customizer = document.querySelector('#customizer');
const customizerForm = document.querySelector('#customizer-form');
const starterName = document.querySelector('#starter-name');
const petNameInput = document.querySelector('#pet-name');
const thought = document.querySelector('#thought');
const heart = document.querySelector('#heart');
const bond = document.querySelector('#bond');
const bondValue = document.querySelector('#bond-value');

const cells = {
  puppy: {
    idle: [0, 0], blink: [1, 0], look: [3, 0], happy: [2, 1], startled: [0, 2],
    sleep: [1, 2], walkLeft: [2, 2], walkRight: [3, 2], play: [0, 3], drag: [3, 3]
  },
  kitten: {
    idle: [0, 0], blink: [1, 0], look: [2, 0], happy: [1, 1], startled: [3, 1],
    sleep: [0, 2], walkLeft: [1, 2], walkRight: [2, 2], play: [3, 2], drag: [1, 3]
  }
};

let profile = { pet: 'puppy', petName: 'Milo', coat: 'brown', affection: 50, reactionsPaused: false };
let draft = { pet: 'puppy', coat: 'brown' };
let idleTimer;
let personalityTimer;
let stateTimer;
let messageTimer;
let typingWindow = [];
let drag = null;
let hoverInside = false;
let lastCursor = null;
let strokeDistance = 0;
let strokeDirection = 0;
let strokes = 0;

function safeName(value, kind = profile.pet) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 18) || (kind === 'kitten' ? 'Mochi' : 'Milo');
}

function setCell(name) {
  const kind = cells[profile.pet] ? profile.pet : 'puppy';
  const [column, row] = cells[kind][name] || cells[kind].idle;
  pet.style.backgroundPosition = `${column * 33.333333}% ${row * 33.333333}%`;
}

function applyProfile(next) {
  profile = { ...profile, ...next };
  profile.petName = safeName(profile.petName, profile.pet);
  const kind = cells[profile.pet] ? profile.pet : 'puppy';
  pet.className = `pet ${kind} coat-${profile.coat || 'brown'}`;
  pet.setAttribute('aria-label', `Pet ${profile.petName}`);
  bond.value = Number(profile.affection) || 0;
  bondValue.textContent = `${Math.round(bond.value)}%`;
  setState('idle');
}

function setState(name, duration = 0) {
  if (profile.reactionsPaused && name !== 'idle') return;
  clearTimeout(stateTimer);
  pet.classList.remove('typing', 'happy', 'startled', 'sleeping', 'dragging');
  setCell(name);
  if (name === 'typing') pet.classList.add('typing');
  if (name === 'happy') pet.classList.add('happy');
  if (name === 'startled') pet.classList.add('startled');
  if (name === 'sleep') pet.classList.add('sleeping');
  if (name === 'drag') pet.classList.add('dragging');
  if (duration) stateTimer = setTimeout(() => setState('idle'), duration);
}

function showThought(text, duration = 1200) {
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
    pet: kind,
    petName: safeName(starterName.value, kind),
    coat: 'brown'
  });
  applyProfile(next);
  chooser.classList.add('hidden');
  wrap.classList.remove('hidden');
  setState('happy', 700);
  showThought(`${profile.petName} is home! ♥`, 1500);
}

document.querySelectorAll('.choice').forEach(button => {
  button.addEventListener('click', () => choose(button.dataset.pet));
});

function refreshCustomizer() {
  petNameInput.value = profile.petName;
  draft = { pet: profile.pet, coat: profile.coat || 'brown' };
  document.querySelectorAll('[data-kind]').forEach(button => button.classList.toggle('active', button.dataset.kind === draft.pet));
  document.querySelectorAll('[data-coat]').forEach(button => button.classList.toggle('active', button.dataset.coat === draft.coat));
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
  document.querySelectorAll('[data-kind]').forEach(item => item.classList.toggle('active', item === button));
}));

document.querySelectorAll('[data-coat]').forEach(button => button.addEventListener('click', () => {
  draft.coat = button.dataset.coat;
  document.querySelectorAll('[data-coat]').forEach(item => item.classList.toggle('active', item === button));
}));

customizerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const next = await window.petAPI.updateProfile({ ...draft, petName: safeName(petNameInput.value, draft.pet) });
  applyProfile(next);
  closeCustomizer();
  setState('happy', 650);
  showThought(`I’m ${profile.petName}!`, 1300);
});

document.querySelector('#cancel-customizer').addEventListener('click', closeCustomizer);

pet.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  pet.setPointerCapture(event.pointerId);
  drag = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    windowX: event.screenX - event.clientX,
    windowY: event.screenY - event.clientY,
    moved: false
  };
});

pet.addEventListener('pointermove', event => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const dx = event.screenX - drag.startScreenX;
  const dy = event.screenY - drag.startScreenY;
  if (!drag.moved && Math.hypot(dx, dy) > 6) {
    drag.moved = true;
    setState('drag');
  }
  if (drag.moved) {
    window.petAPI.moveWindow({
      x: event.screenX - (drag.startScreenX - drag.windowX),
      y: event.screenY - (drag.startScreenY - drag.windowY)
    });
  }
});

function finishPointer(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  try { pet.releasePointerCapture(event.pointerId); } catch {}
  if (drag.moved) {
    setState('happy', 550);
    showThought('New spot!', 900);
  } else {
    setState('happy', 650);
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
    setState('happy', 650);
    popHeart();
    window.petAPI.addAffection(1);
  }
});

window.petAPI.onCursor(position => {
  const panelOpen = !customizer.classList.contains('hidden') || !chooser.classList.contains('hidden');
  if (panelOpen) {
    lastCursor = position;
    return;
  }
  const center = 160;
  const dx = position.x - center;
  const dy = position.y - center;
  const distance = Math.hypot(dx, dy);
  const inside = distance < 120 && position.y > 58 && position.y < 292;

  if (inside !== hoverInside) {
    hoverInside = inside;
    window.petAPI.setClickThrough(!inside);
  }

  if (!drag && !profile.reactionsPaused) {
    const tilt = Math.max(-4, Math.min(4, dx / 34));
    pet.style.setProperty('--cursor-tilt', `${tilt}deg`);
    if (distance < 190 && !pet.classList.contains('typing') && !pet.classList.contains('happy')) setCell('look');
  }

  if (inside && lastCursor && !drag) {
    const stepX = position.screenX - lastCursor.screenX;
    const stepY = position.screenY - lastCursor.screenY;
    const step = Math.hypot(stepX, stepY);
    if (step > 1 && step < 24) {
      strokeDistance += step;
      const direction = Math.sign(stepX);
      if (direction && strokeDirection && direction !== strokeDirection) strokes += 1;
      if (direction) strokeDirection = direction;
      if (strokeDistance > 150 && strokes >= 3) {
        setState('happy', 800);
        popHeart();
        window.petAPI.addAffection(2);
        profile.affection = Math.min(100, Number(profile.affection) + 2);
        strokeDistance = 0;
        strokes = 0;
      }
    }
  } else if (!inside) {
    strokeDistance = Math.max(0, strokeDistance - 4);
    strokes = Math.max(0, strokes - .1);
  }
  lastCursor = position;
  resetIdleTimer();
});

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!drag && !profile.reactionsPaused) {
      setState('sleep');
      showThought('z z z', 2400);
    }
  }, 1000 * 60 * 4);
}

function schedulePersonalityMoment() {
  clearTimeout(personalityTimer);
  personalityTimer = setTimeout(() => {
    if (!drag && !profile.reactionsPaused && customizer.classList.contains('hidden') && chooser.classList.contains('hidden')) {
      const moments = [
        () => setState('blink', 380),
        () => setState('play', 900),
        () => showThought(profile.pet === 'puppy' ? 'Play?' : 'Purr…', 1000)
      ];
      moments[Math.floor(Math.random() * moments.length)]();
    }
    schedulePersonalityMoment();
  }, 12000 + Math.random() * 16000);
}

window.petAPI.onTyping(() => {
  if (profile.reactionsPaused || drag) return;
  const now = Date.now();
  typingWindow.push(now);
  typingWindow = typingWindow.filter(time => now - time < 1300);
  setState('typing', 250);
  if (typingWindow.length >= 9) {
    setState('play', 900);
    showThought(profile.pet === 'puppy' ? `${profile.petName} believes in you!` : `${profile.petName} is supervising…`, 1300);
    typingWindow = [];
  }
  resetIdleTimer();
});

window.petAPI.onWake(() => {
  setState('happy', 850);
  showThought(`${profile.petName} missed you! ♥`, 1500);
});

window.petAPI.onSelectPet(next => {
  applyProfile(next);
  customizer.classList.add('hidden');
  chooser.classList.add('hidden');
  wrap.classList.remove('hidden');
  setState('happy', 700);
});

window.petAPI.onOpenSelector(() => {
  starterName.value = profile.petName;
  wrap.classList.add('hidden');
  customizer.classList.add('hidden');
  chooser.classList.remove('hidden');
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
