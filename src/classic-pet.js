(() => {
  const CELL_COUNT = 4;

  class ClassicPet {
    constructor(canvas, profile = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { willReadFrequently:true });
      this.ctx.imageSmoothingEnabled = true;
      this.profile = profile;
      this.state = 'idle';
      this.images = {};
      this.loading = {};
    }

    setProfile(profile) {
      const previousPet = this.profile.pet;
      this.profile = { ...this.profile, ...profile };
      if (previousPet !== this.profile.pet || !this.images[this.profile.pet]) this.load();
      else this.draw();
    }

    setState(state) {
      this.state = state;
      this.draw();
    }

    load() {
      const kind = this.profile.pet === 'puppy' ? 'puppy' : 'kitten';
      if (this.images[kind]) return this.draw();
      if (this.loading[kind]) return;
      const image = new Image();
      this.loading[kind] = true;
      image.onload = () => {
        this.images[kind] = image;
        delete this.loading[kind];
        this.draw();
      };
      image.onerror = () => { delete this.loading[kind]; };
      image.src = `../assets/${kind}-sprites.png`;
    }

    tintPixel(data, index, target, amount = 1) {
      const sourceLight = (data[index] * .299 + data[index + 1] * .587 + data[index + 2] * .114) / 210;
      const shade = Math.max(.28, Math.min(1.32, sourceLight));
      const rgb = target.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
      const mix = Math.max(0, Math.min(1, amount));
      data[index] = Math.round(data[index] * (1 - mix) + rgb[0] * shade * mix);
      data[index + 1] = Math.round(data[index + 1] * (1 - mix) + rgb[1] * shade * mix);
      data[index + 2] = Math.round(data[index + 2] * (1 - mix) + rgb[2] * shade * mix);
    }

    recolor() {
      const { width, height } = this.canvas;
      const image = this.ctx.getImageData(0, 0, width, height);
      const data = image.data;
      const base = this.profile.baseColor || '#f4eadb';
      const patch = this.profile.patchColor || '#9b6548';
      const eye = this.profile.eyeColor || '#d89b35';

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 12) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;
        const light = (r + g + b) / 3;

        const warmPatch = r > g * 1.05 && g > b * 1.03 && saturation > 18;
        const goldenEye = r > 105 && g > 55 && b < 80 && r - b > 55 && g - b > 22;
        const paleFur = light > 108 && saturation < 55;

        if (goldenEye && light < 175) this.tintPixel(data, i, eye, .82);
        else if (warmPatch) this.tintPixel(data, i, patch, .72);
        else if (paleFur) this.tintPixel(data, i, base, .66);
      }
      this.ctx.putImageData(image, 0, 0);
    }

    draw() {
      const kind = this.profile.pet === 'puppy' ? 'puppy' : 'kitten';
      const image = this.images[kind];
      if (!image) return this.load();
      const states = window.classicCells?.[kind] || {};
      const [column, row] = states[this.state] || states.idle || [0, 0];
      const sourceWidth = image.naturalWidth / CELL_COUNT;
      const sourceHeight = image.naturalHeight / CELL_COUNT;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(
        image,
        column * sourceWidth,
        row * sourceHeight,
        sourceWidth,
        sourceHeight,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      this.recolor();
    }
  }

  window.ClassicPet = ClassicPet;
})();

