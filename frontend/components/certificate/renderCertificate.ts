/**
 * renderCertificate.ts (v2.2 W2 contract §5).
 *
 * Renders a V2-styled certificate to a <canvas> at a high-PPI size and
 * resolves a `Blob` (PNG) via `canvas.toBlob()`. The canvas uses
 * self-hosted `@fontsource/space-grotesk` / `jetbrains-mono` — no
 * external font CDNs, no images, no canvas libraries. Caller is
 * responsible for `await document.fonts.ready` before invoking.
 */

export interface CertificateInput {
  /** Cycle name (e.g. "Demo Month"). */
  monthName: string;
  /** "YYYY-MM-DD" | null. */
  startDate: string | null;
  /** "YYYY-MM-DD" | null. */
  endDate: string | null;
  /** Final tier (e.g. "Gold"). */
  finalTier: string;
  /** Lifetime XP earned this cycle. */
  totalXP: number;
  /** Number of perfect days. */
  perfectDays: number;
  /** Best habit description. */
  bestHabit: string | null;
  /** Best combo name (e.g. "QUAD STRIKE"). */
  bestStrike: string | null;
  /** Player display name. */
  playerName: string | null;
  /** Level title. */
  playerTitle: string;
  /** Player level (number). */
  playerLevel: number;
  /** Finish date "YYYY-MM-DD". */
  finishedOn: string;
}

/**
 * Render the certificate to a canvas. The canvas is created at 1200×900
 * (3× the viewport display) and returned via the `toBlob` promise. Use
 * the returned blob with `URL.createObjectURL` to build a download link
 * or render to the screen.
 */
export async function renderCertificateToBlob(
  input: CertificateInput,
): Promise<Blob> {
  const W = 1200;
  const H = 900;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }
  drawBackground(ctx, W, H);
  drawChamfer(ctx, W, H);
  drawHeader(ctx, W);
  drawMonthTitle(ctx, input, W);
  drawDates(ctx, input, W);
  drawStatBlocks(ctx, input, W, H);
  drawFooter(ctx, input, W, H);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("toBlob returned null"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

/** Filename helper: `pixelpaladin-<month>.png`, slugs friendly. */
export function certificateFilename(monthName: string): string {
  const slug = (monthName || "month")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "month";
  return `pixelpaladin-${slug}.png`;
}

// ---------- drawing primitives ----------

function drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // --pp-void ≈ #0f141f
  ctx.fillStyle = "#0f141f";
  ctx.fillRect(0, 0, W, H);
  // Faint scanlines
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#00f0ff";
  for (let y = 0; y < H; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y + 1);
    ctx.lineTo(W, y + 1);
    ctx.stroke();
  }
  ctx.restore();
}

const CHAMFER = 32;

function drawChamfer(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const c = CHAMFER;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H - c);
  ctx.lineTo(W - c, H);
  ctx.lineTo(0, H);
  ctx.lineTo(0, c);
  ctx.closePath();
  // Inner panel surface
  ctx.fillStyle = "#141a2a";
  ctx.fill();
  // Outer border (cyan)
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#00f0ff";
  ctx.stroke();
  // Magenta accent stripe inside the border
  ctx.beginPath();
  ctx.moveTo(c + 16, 4);
  ctx.lineTo(W - 16, 4);
  ctx.lineTo(W - 16, H - 16);
  ctx.lineTo(W - c - 16, H - 4);
  ctx.lineTo(16, H - 4);
  ctx.lineTo(16, c + 16);
  ctx.closePath();
  ctx.strokeStyle = "#ff007f";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHeader(ctx: CanvasRenderingContext2D, W: number) {
  ctx.save();
  ctx.fillStyle = "#00f0ff";
  ctx.font = "700 24px 'Space Grotesk', system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("PIXEL PALADIN", 64, 64);
  ctx.fillStyle = "#ff007f";
  ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText("COMBAT DECK // CERTIFICATE OF COMPLETION", 64, 100);
  ctx.textAlign = "right";
  ctx.fillStyle = "#7080a0";
  ctx.fillText("PIXEL PALADIN", W - 64, 64);
  ctx.restore();
}

function drawMonthTitle(ctx: CanvasRenderingContext2D, input: CertificateInput, W: number) {
  ctx.save();
  ctx.fillStyle = "#f0f4ff";
  ctx.font = "700 56px 'Space Grotesk', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  // Long names truncate gracefully.
  const title = (input.monthName || "Untitled Month").toUpperCase();
  ctx.fillText(fitText(ctx, title, W - 192, 56), W / 2, 152);
  ctx.restore();
}

function drawDates(ctx: CanvasRenderingContext2D, input: CertificateInput, W: number) {
  ctx.save();
  ctx.fillStyle = "#7080a0";
  ctx.font = "400 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const start = input.startDate || "—";
  const end = input.endDate || input.finishedOn || "—";
  ctx.fillText(`Range: ${start}  to  ${end}`, W / 2, 232);
  ctx.restore();
}

function drawStatBlocks(
  ctx: CanvasRenderingContext2D,
  input: CertificateInput,
  W: number,
  H: number,
) {
  const blocks: Array<{
    label: string;
    value: string;
    color: string;
  }> = [
    { label: "Final Tier", value: (input.finalTier || "Bronze").toUpperCase(), color: "#00f0ff" },
    { label: "Total XP", value: `${input.totalXP ?? 0} XP`, color: "#ff007f" },
    { label: "Perfect Days", value: `${input.perfectDays ?? 0}`, color: "#00ff66" },
    { label: "Best Habit", value: truncate(input.bestHabit || "—", 22), color: "#ffbe0b" },
    { label: "Best Strike", value: input.bestStrike || "—", color: "#ff007f" },
  ];
  ctx.save();
  const blockW = (W - 128 - (blocks.length - 1) * 16) / blocks.length;
  const blockH = 220;
  const top = 300;
  const left = 64;
  ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const x = left + i * (blockW + 16);
    const y = top;
    // panel
    ctx.fillStyle = "#1a2238";
    ctx.fillRect(x, y, blockW, blockH);
    ctx.strokeStyle = "#2a3458";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, blockW, blockH);
    // label
    ctx.fillStyle = "#7080a0";
    ctx.textAlign = "left";
    ctx.fillText(b.label.toUpperCase(), x + 14, y + 14);
    // value (auto-fit)
    ctx.fillStyle = b.color;
    ctx.font = "700 28px 'Space Grotesk', system-ui, sans-serif";
    const v = fitText(ctx, b.value, blockW - 28, 30);
    ctx.fillText(v, x + 14, y + 60);
    // bottom strip
    ctx.fillStyle = b.color;
    ctx.fillRect(x, y + blockH - 4, blockW, 4);
  }
  void H;
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: CertificateInput,
  W: number,
  H: number,
) {
  ctx.save();
  const y = H - 200;
  // Player block
  ctx.fillStyle = "#1a2238";
  ctx.fillRect(64, y, W - 128, 140);
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 1;
  ctx.strokeRect(64, y, W - 128, 140);
  ctx.fillStyle = "#7080a0";
  ctx.font = "700 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("OPERATOR", 84, y + 18);
  ctx.fillStyle = "#f0f4ff";
  ctx.font = "700 32px 'Space Grotesk', system-ui, sans-serif";
  ctx.fillText((input.playerName || "Anonymous").toUpperCase(), 84, y + 38);
  ctx.fillStyle = "#00ff66";
  ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
  const title = input.playerTitle ? `LVL ${input.playerLevel ?? 1} · ${input.playerTitle.toUpperCase()}` : `LVL ${input.playerLevel ?? 1}`;
  ctx.fillText(title, 84, y + 86);
  // Finish date (right side)
  ctx.fillStyle = "#7080a0";
  ctx.font = "700 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.fillText("FINISHED", W - 84, y + 18);
  ctx.fillStyle = "#f0f4ff";
  ctx.font = "700 22px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillText(input.finishedOn || "—", W - 84, y + 40);
  // bottom signature
  ctx.fillStyle = "#7080a0";
  ctx.font = "700 12px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("PIXEL PALADIN · SEASON CAMPAIGN", W / 2, H - 60);
  ctx.restore();
}

/**
 * Re-measure `value` against a max pixel width. When it overflows,
 * trim to `max-3` chars + "…". Otherwise return `value` as-is.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  _fontPx: number,
): string {
  void _fontPx;
  if (ctx.measureText(value).width <= maxWidth) return value;
  const ellipsis = "…";
  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    const candidate = value.slice(0, mid) + ellipsis;
    if (ctx.measureText(candidate).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return value.slice(0, lo) + ellipsis;
}

function truncate(s: string, max: number): string {
  if (!s) return s;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
