document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('fireflies-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx || !canvas.parentElement) return;

  let width = 0;
  let height = 0;
  let fireflies = [];
  const fireflyCount = 40;

  function resize() {
    const parent = canvas.parentElement;
    width = canvas.width = canvas.parentElement.clientWidth;
    height = canvas.height = canvas.parentElement.clientHeight;
    fireflies.forEach((firefly) => {
      firefly.x = Math.min(firefly.x, width);
      firefly.y = Math.min(firefly.y, height);
    });
  }

  window.addEventListener('resize', resize, { passive: true });

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

  resize();
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
