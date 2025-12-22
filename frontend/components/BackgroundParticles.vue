<template>
  <!-- Full-screen animated particle canvas (client-side only) -->
  <div class="bg-particles-wrapper" aria-hidden="true">
    <canvas ref="canvasEl" class="bg-particles-canvas"></canvas>
    <div v-if="debug" class="debug-label">Particles Debug ON</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  shape: "square" | "circle";
  hue: number;
}

const props = defineProps<{
  count?: number; // approximate number of particles
  maxVelocity?: number; // max pixel per second velocity component
  lighten?: number; // lighten factor for hues
  debug?: boolean; // show debug overlay & logs
  linkDistance?: number; // distance threshold to draw links
  linkOpacity?: number; // base opacity for links
}>();

const canvasEl = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frameId = 0;
let lastTs = 0;
let width = 0;
let height = 0;
let dpr = 1;

// Config with fallbacks
const BASE_COUNT = props.count ?? 110; // more density for visibility
const MAX_V = props.maxVelocity ?? 28; // slightly faster
const debug = props.debug ?? false;
const LINK_DIST = props.linkDistance ?? 110;
const LINK_OPACITY = props.linkOpacity ?? 0.09;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function initParticles() {
  particles = [];
  const effectiveCount = Math.round(
    (BASE_COUNT * (width * height)) / (1920 * 1080)
  );
  for (let i = 0; i < effectiveCount; i++) {
    const size = rand(1.5, 3.8); // larger for visibility
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: rand(-MAX_V, MAX_V) / 1000, // convert to px/ms
      vy: rand(-MAX_V, MAX_V) / 1000,
      size,
      baseSize: size,
      alpha: rand(0.25, 0.75),
      twinkleSpeed: rand(0.0003, 0.0012),
      twinklePhase: Math.random() * Math.PI * 2,
      shape: Math.random() < 0.6 ? "square" : "circle",
      hue: rand(205, 250), // cool subtle blues -> violets
    });
  }
  if (debug)
    console.log(
      "[BackgroundParticles] init count=",
      particles.length,
      "canvas",
      width,
      height
    );
}

function resize() {
  if (!canvasEl.value) return;
  width = window.innerWidth;
  height = Math.max(window.innerHeight, document.documentElement.scrollHeight);
  dpr = window.devicePixelRatio || 1;
  canvasEl.value.width = width * dpr;
  canvasEl.value.height = height * dpr;
  canvasEl.value.style.width = width + "px";
  canvasEl.value.style.height = height + "px";
  ctx = canvasEl.value.getContext("2d");
  if (ctx) ctx.scale(dpr, dpr);
  initParticles();
  if (debug)
    console.log("[BackgroundParticles] resize", { width, height, dpr });
}

function step(ts: number) {
  if (!ctx) return;
  const dt = lastTs ? ts - lastTs : 16; // ms
  lastTs = ts;

  ctx.clearRect(0, 0, width, height);

  // Layered gradient background (depth): radial + angled linear
  const grad = ctx.createRadialGradient(
    width * 0.55,
    height * 0.6,
    Math.min(width, height) * 0.05,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.85
  );
  grad.addColorStop(0, "rgba(60,80,130,0.20)");
  grad.addColorStop(1, "rgba(5,10,25,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  const lg = ctx.createLinearGradient(0, 0, width, height);
  lg.addColorStop(0, "rgba(20,30,55,0.55)");
  lg.addColorStop(1, "rgba(5,8,20,0.75)");
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, width, height);

  // Draw particles (with glow pass)
  for (const p of particles) {
    // update
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    // wrap edges for continuous field
    if (p.x < -10) p.x = width + 10;
    else if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    else if (p.y > height + 10) p.y = -10;

    // twinkle
    p.twinklePhase += p.twinkleSpeed * dt;
    const twinkle = (Math.sin(p.twinklePhase) + 1) / 2; // 0..1
    const alpha = p.alpha * (0.4 + twinkle * 0.6);
    const size = p.baseSize * (0.85 + twinkle * 0.3);

    const color = `hsla(${p.hue}, 82%, 75%, 1)`;
    // Glow (blur via shadow) then solid core
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = color;
    ctx.shadowColor = `hsla(${p.hue}, 90%, 70%, 0.9)`;
    ctx.shadowBlur = size * 2.2;
    if (p.shape === "square") {
      ctx.fillRect(p.x, p.y, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha;
    if (p.shape === "square") {
      ctx.fillRect(p.x, p.y, size * 0.6, size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(p.x + size * 0.2, p.y + size * 0.2, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Connection lines (limit work): only attempt if particle count < 300
  if (particles.length && particles.length < 300) {
    ctx.globalAlpha = 1;
    ctx.lineWidth = 0.7;
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      let connections = 0;
      for (let j = i + 1; j < particles.length && connections < 4; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const o = (1 - dist / LINK_DIST) * LINK_OPACITY;
          if (o > 0.005) {
            ctx.strokeStyle = `rgba(140,170,255,${o})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            connections++;
          }
        }
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.globalAlpha = 1; // reset

  frameId = requestAnimationFrame(step);
}

function start() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Respect reduced motion: single static layer
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    for (const p of particles) {
      ctx.globalAlpha = p.alpha * 0.8;
      ctx.fillStyle = `hsla(${p.hue}, 55%, 68%, 1)`;
      ctx.fillRect(p.x, p.y, p.size * 1.2, p.size * 1.2);
    }
    ctx.globalAlpha = 1;
    return; // no animation
  }
  frameId = requestAnimationFrame(step);
}

onMounted(() => {
  if (typeof window === "undefined") return; // SSR safeguard
  resize();
  window.addEventListener("resize", resize, { passive: true });
  start();
  if (debug) console.log("[BackgroundParticles] mounted");
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resize);
  cancelAnimationFrame(frameId);
});
</script>

<style scoped>
.bg-particles-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1; /* above gradient, below content */
  pointer-events: none;
  background: transparent;
}
.bg-particles-canvas {
  width: 100%;
  height: 100%;
  display: block;
  filter: contrast(115%) brightness(112%) saturate(118%);
  opacity: 0.7; /* slightly stronger */
  mix-blend-mode: screen;
}

@media (prefers-reduced-motion: reduce) {
  .bg-particles-canvas {
    opacity: 0.35;
  }
}
</style>
