const pet = document.querySelector('#pet');
const wrap = document.querySelector('#pet-wrap');
const chooser = document.querySelector('#chooser');
const thought = document.querySelector('#thought');
const heart = document.querySelector('#heart');

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

let activePet = 'puppy';
let paused = false;
let idleTimer;
let stateTimer;
let messageTimer;
let typingWindow = [];
let drag = null;
let hoverInside = false;
let lastCursor = null;
let strokeDistance = 0;
let strokeDirection = 0;
let strokes = 0;

function setCell(name) {
  const [column, row] = cells[activePet][name] || cells[activePet].idle;
  pet.style.backgroundPosition = `${column * 33.333333}% ${row * 33.333333}%`;
}

function setState(name, duration = 0) {
  if (paused && name !== 'idle') return;
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

function choose(type) {
  activePet = type;
  pet.className = `pet ${type}`;
  setState('happy', 700);
  chooser.classList.add('hidden');
  wrap.classList.remove('hidden');
  window.petAPI.selectPet(type);
  showThought(type === 'puppy' ? 'Woof! ♥' : 'Purr… ♥', 1100);
}

document.querySelectorAll('.choice').forEach(button => {
  button.addEventListener('click', () => choose(button.dataset.pet));
});

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
  }
  drag = null;
}

pet.addEventListener('pointerup', finishPointer);
pet.addEventListener('pointercancel', finishPointer);
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
  const center = 160;
  const dx = position.x - center;
  const dy = position.y - center;
  const distance = Math.hypot(dx, dy);
  const inside = distance < 120 && position.y > 58 && position.y < 292;

  if (inside !== hoverInside) {
    hoverInside = inside;
    window.petAPI.setClickThrough(!inside);
  }

  if (!drag && !paused) {
    const tilt = Math.max(-4, Math.min(4, dx / 34));
    pet.style.setProperty('--cursor-tilt', `${tilt}deg`);
    if (distance < 190 && !pet.classList.contains('typing') && !pet.classList.contains('happy')) {
      setCell('look');
    }
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
    if (!drag && !paused) {
      setState('sleep');
      showThought('z z z', 2400);
    }
  }, 1000 * 60 * 4);
}

window.petAPI.onTyping(() => {
  if (paused || drag) return;
  const now = Date.now();
  typingWindow.push(now);
  typingWindow = typingWindow.filter(time => now - time < 1300);
  setState('typing', 250);
  if (typingWindow.length >= 9) {
    setCell('play');
    showThought(activePet === 'puppy' ? 'You’ve got this!' : 'Busy human…', 1100);
    typingWindow = [];
  }
  resetIdleTimer();
});

window.petAPI.onWake(() => {
  setState('happy', 850);
  showThought('You’re back! ♥', 1500);
});

window.petAPI.onSelectPet(type => {
  if (type === 'puppy' || type === 'kitten') {
    activePet = type;
    pet.className = `pet ${type}`;
    chooser.classList.add('hidden');
    wrap.classList.remove('hidden');
    setState('happy', 700);
  }
});

window.petAPI.onOpenSelector(() => {
  wrap.classList.add('hidden');
  chooser.classList.remove('hidden');
  window.petAPI.setClickThrough(false);
});

window.petAPI.onSettings(next => {
  paused = Boolean(next.reactionsPaused);
  if (paused) setState('idle');
});

window.petAPI.getSettings().then(current => {
  paused = Boolean(current.reactionsPaused);
  if (current.pet === 'puppy' || current.pet === 'kitten') {
    activePet = current.pet;
    pet.className = `pet ${activePet}`;
    wrap.classList.remove('hidden');
    setState('idle');
    window.petAPI.setClickThrough(true);
  } else {
    chooser.classList.remove('hidden');
    window.petAPI.setClickThrough(false);
  }
  resetIdleTimer();
});
