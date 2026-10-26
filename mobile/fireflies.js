document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('fireflies-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let fireflies = [];
  const fireflyCount = 40;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();

  class Firefly {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.radius = Math.random() * 2 + 1;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.alpha = Math.random();
      this.alphaChange = (Math.random() * 0.015 + 0.005) * (Math.random() < 0.5 ? 1 : -1);
      this.color = Math.random() > 0.3 ? '255, 255, 255' : '180, 220, 255';
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
      this.alpha += this.alphaChange;
      if (this.alpha <= 0.1) this.alphaChange = Math.abs(this.alphaChange);
      else if (this.alpha >= 0.95) this.alphaChange = -Math.abs(this.alphaChange);
    }

    draw() {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${this.color}, ${this.alpha})`;
      ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < fireflyCount; i += 1) fireflies.push(new Firefly());

  function animate() {
    ctx.clearRect(0, 0, width, height);
    fireflies.forEach((firefly) => {
      firefly.update();
      firefly.draw();
    });
    requestAnimationFrame(animate);
  }

  animate();
});
