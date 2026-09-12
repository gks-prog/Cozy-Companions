+(() => {
  const OUTLINE = '#35231f';
  const NOSE = '#e98f8f';
  const INNER_EAR = '#efaaaa';
  const COLLAR = '#168c8a';

  class PixelPet {
    constructor(canvas, profile = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.profile = profile;
      this.state = 'idle';
      this.gaze = { x: 0, y: 0 };
      this.typingSide = 'left';
      this.startedAt = performance.now();
      this.running = false;
    }

    setProfile(profile) {
      this.profile = { ...this.profile, ...profile };
      this.draw(performance.now());
    }

    setState(state, detail = {}) {
      this.state = state;
      if (detail.side) this.typingSide = detail.side;
      this.startedAt = performance.now();
      this.draw(this.startedAt);
    }

    setGaze(x, y) {
      this.gaze.x = Math.max(-2, Math.min(2, x));
      this.gaze.y = Math.max(-1, Math.min(1, y));
    }

    start() {
      if (this.running) return;
      this.running = true;
      const tick = now => {
        if (!this.running) return;
        this.draw(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    stop() { this.running = false; }

    palette() {
      return {
        base: this.profile.baseColor || '#f4eadb',
        patch: this.profile.patchColor || '#9b6548',
        eye: this.profile.eyeColor || '#d89b35'
      };
    }

    path(points) {
      const shape = new Path2D();
      shape.moveTo(points[0][0], points[0][1]);
      points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
      shape.closePath();
      return shape;
    }

    fillShape(shape, color, stroke = true) {
      const c = this.ctx;
      c.fillStyle = color;
      c.fill(shape);
      if (stroke) {
        c.strokeStyle = OUTLINE;
        c.lineWidth = 2;
        c.lineJoin = 'miter';
        c.stroke(shape);
      }
    }

    block(x, y, w, h, color = OUTLINE) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    pattern(head, body, tailArea) {
      const c = this.ctx;
      const { patch } = this.palette();
      const pattern = this.profile.pattern || 'mask';
      c.save();
      c.beginPath();
      c.clip(head);
      c.clip(body);
      c.restore();

      const paintClipped = draw => {
        c.save();
        const combined = new Path2D();
        combined.addPath(head);
        combined.addPath(body);
        c.clip(combined);
        c.fillStyle = patch;
        draw(c);
        c.restore();
      };

      if (pattern === 'solid') return;
      if (pattern === 'mask') paintClipped(ctx => {
        ctx.fillRect(11, 8, 19, 22);
        ctx.fillRect(35, 8, 20, 22);
        ctx.fillRect(35, 34, 20, 24);
      });
      if (pattern === 'tuxedo') paintClipped(ctx => {
        ctx.fillRect(8, 7, 50, 15);
        ctx.fillRect(13, 17, 12, 12);
        ctx.fillRect(40, 17, 12, 12);
        ctx.fillRect(14, 35, 36, 18);
      });
      if (pattern === 'socks') paintClipped(ctx => {
        ctx.fillRect(9, 8, 47, 18);
        ctx.fillRect(16, 33, 34, 17);
      });
      if (pattern === 'spots') paintClipped(ctx => {
        ctx.fillRect(15, 13, 10, 8);
        ctx.fillRect(39, 19, 12, 9);
        ctx.fillRect(20, 37, 11, 10);
        ctx.fillRect(39, 42, 9, 8);
      });
      if (pattern === 'calico') paintClipped(ctx => {
        ctx.fillRect(11, 9, 16, 12);
        ctx.fillRect(39, 14, 13, 14);
        ctx.fillRect(17, 36, 12, 13);
        ctx.fillRect(37, 40, 15, 11);
      });
      if (pattern === 'tabby') paintClipped(ctx => {
        ctx.fillRect(28, 9, 3, 10);
        ctx.fillRect(34, 9, 3, 10);
        ctx.fillRect(15, 18, 10, 3);
        ctx.fillRect(42, 18, 10, 3);
        ctx.fillRect(20, 36, 3, 13);
        ctx.fillRect(29, 34, 3, 15);
        ctx.fillRect(38, 36, 3, 13);
      });
      if (tailArea && pattern !== 'solid') {
        c.fillStyle = patch;
        c.fillRect(tailArea.x, tailArea.y, tailArea.w, tailArea.h);
      }
    }

    drawTail(palette, lift = 0) {
      const c = this.ctx;
      c.strokeStyle = OUTLINE;
      c.lineWidth = 9;
      c.lineCap = 'square';
      c.beginPath();
      c.moveTo(45, 52);
      c.lineTo(54, 49 - lift);
      c.lineTo(55, 37 - lift);
      c.lineTo(51, 32 - lift);
      c.stroke();
      c.strokeStyle = palette.patch;
      c.lineWidth = 5;
      c.stroke();
      this.block(52, 34 - lift, 5, 3, palette.base);
    }

    drawSeated(now) {
      const c = this.ctx;
      const p = this.palette();
      const phase = (now - this.startedAt) / 180;
      const bob = this.state === 'idle' ? Math.round(Math.sin(phase) * .6) : 0;
      const lifted = ['happy', 'startled', 'pounce'].includes(this.state) ? -2 : 0;
      const y = bob + lifted;
      c.save();
      c.translate(0, y);

      this.drawTail(p, this.state === 'happy' ? 3 : 0);
      const body = this.path([[16,31],[47,31],[51,55],[47,59],[16,59],[12,55]]);
      const isPuppy = this.profile.pet === 'puppy';
      const head = isPuppy
        ? this.path([[13,17],[18,11],[24,17],[40,17],[47,11],[52,18],[50,35],[43,41],[20,41],[13,35]])
        : this.path([[12,31],[13,11],[23,17],[31,13],[41,17],[51,11],[52,31],[45,40],[19,40]]);
      this.fillShape(body, p.base);
      this.fillShape(head, p.base);
      this.pattern(head, body, { x: 51, y: 32, w: 7, h: 14 });
      c.strokeStyle = OUTLINE; c.lineWidth = 2; c.stroke(body); c.stroke(head);

      if (isPuppy) {
        this.fillShape(this.path([[13,17],[8,18],[10,32],[17,29],[21,17]]), p.patch);
        this.fillShape(this.path([[44,17],[51,14],[55,20],[51,32],[44,27]]), p.patch);
        this.block(25, 32, 14, 7, p.base);
        this.block(27, 37, 10, 2, OUTLINE);
      } else {
        this.block(15, 14, 4, 5, INNER_EAR);
        this.block(46, 14, 4, 5, INNER_EAR);
        this.block(8, 30, 8, 2); this.block(48, 30, 8, 2);
        this.block(9, 34, 8, 2); this.block(47, 34, 8, 2);
      }

      const blinkCycle = now % 7200 > 6850;
      const closed = this.state === 'blink' || this.state === 'sleep' || this.state === 'happy' || blinkCycle;
      this.drawFace(p, closed, isPuppy);
      this.drawCollar();
      this.drawPaws(p);

      if (this.state === 'typing') this.drawTyping(p);
      if (this.state === 'groom') {
        this.fillShape(this.path([[17,39],[22,31],[27,34],[25,48],[18,49]]), p.base);
        this.block(17, 28, 4, 4, p.base);
      }
      if (this.state === 'startled') {
        this.block(7, 18, 3, 7, '#e5a12d');
        this.block(54, 18, 3, 7, '#e5a12d');
      }
      if (this.state === 'pounce') {
        this.block(6, 45, 8, 3, p.base);
        this.block(50, 45, 8, 3, p.base);
      }
      c.restore();
    }

    drawFace(p, closed, puppy) {
      const c = this.ctx;
      if (closed) {
        this.block(20, 26, 8, 2);
        this.block(37, 26, 8, 2);
      } else {
        for (const x of [20, 39]) {
          this.block(x, 23, 7, 8, OUTLINE);
          this.block(x + 1, 24, 5, 6, p.eye);
          this.block(x + 3 + this.gaze.x, 25 + this.gaze.y, 2, 4, '#211818');
          this.block(x + 1, 24, 2, 2, '#fffdf7');
        }
      }
      this.block(31, 30, 3, 2, NOSE);
      this.block(32, 32, 1, 2, OUTLINE);
      this.block(28, 34, 4, 1, OUTLINE);
      this.block(33, 34, 4, 1, OUTLINE);
      if (puppy && this.state === 'happy') this.block(31, 35, 4, 4, '#e96f7c');
    }

    drawCollar() {
      this.block(20, 39, 25, 2, OUTLINE);
      this.block(21, 39, 23, 1, COLLAR);
      this.block(30, 41, 5, 5, OUTLINE);
      this.block(31, 42, 3, 3, '#36bbb1');
    }

    drawPaws(p) {
      this.block(17, 49, 11, 9, p.base);
      this.block(37, 49, 11, 9, p.base);
      this.block(17, 57, 11, 2, OUTLINE);
      this.block(37, 57, 11, 2, OUTLINE);
      this.block(22, 54, 1, 4, OUTLINE);
      this.block(42, 54, 1, 4, OUTLINE);
    }

    drawTyping(p) {
      const left = this.typingSide === 'left';
      const x = left ? 12 : 40;
      this.fillShape(this.path([[x,42],[x + 10,42],[x + 12,56],[x + 6,60],[x - 1,56]]), p.base);
      this.block(left ? 7 : 53, 56, 4, 2, '#4aa4c8');
      this.block(left ? 5 : 55, 52, 3, 2, '#4aa4c8');
    }

    drawSleep(now) {
      const c = this.ctx;
      const p = this.palette();
      const rise = Math.round(Math.sin(now / 620));
      c.save(); c.translate(0, rise);
      this.fillShape(this.path([[8,43],[12,32],[24,25],[43,27],[54,37],[53,51],[44,57],[20,57],[10,51]]), p.base);
      c.fillStyle = p.patch; c.fillRect(34,29,16,17); c.fillRect(12,42,16,12);
      this.fillShape(this.path([[17,42],[18,25],[27,31],[35,27],[45,34],[42,47],[34,52],[23,50]]), p.base);
      this.block(22, 38, 7, 2); this.block(34, 38, 7, 2);
      this.block(30, 42, 3, 2, NOSE);
      c.strokeStyle = p.patch; c.lineWidth = 6; c.beginPath(); c.moveTo(50,43); c.lineTo(39,53); c.lineTo(24,54); c.stroke();
      c.restore();
    }

    draw(now = performance.now()) {
      const c = this.ctx;
      c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      c.imageSmoothingEnabled = false;
      if (this.state === 'sleep') this.drawSleep(now);
      else this.drawSeated(now);
    }
  }

  window.PixelPet = PixelPet;
})();

