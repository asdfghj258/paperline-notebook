import { Note, NoteObject, Point, Background } from "./types";
export function worldPoint(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
  viewport: Note["viewport"],
): Point {
  const r = canvas.getBoundingClientRect();
  // canvas.width/height are backing-store pixels (DPR-scaled), while pointer
  // coordinates and the viewport transform use CSS pixels. Mixing the two
  // causes large offsets on Retina/iPad displays, especially after zooming.
  const cssX = (e.clientX - r.left) * (canvas.clientWidth / r.width);
  const cssY = (e.clientY - r.top) * (canvas.clientHeight / r.height);
  return {
    x: (cssX - canvas.clientWidth / 2) / viewport.zoom - viewport.x,
    y: (cssY - canvas.clientHeight / 2) / viewport.zoom - viewport.y,
  };
}
export function renderCanvas(canvas: HTMLCanvasElement, note: Note) {
  const dpr = devicePixelRatio || 1;
  const ctx = canvas.getContext("2d")!;
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(
    w / 2 + note.viewport.x * note.viewport.zoom,
    h / 2 + note.viewport.y * note.viewport.zoom,
  );
  ctx.scale(note.viewport.zoom, note.viewport.zoom);
  drawBackground(ctx, w, h, note.background, note.viewport.zoom);
  for (const o of note.objects) drawObject(ctx, o);
  ctx.restore();
}
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  b: Background,
  z: number,
) {
  if (b === "plain") return;
  const span = b === "grid" ? 24 : b === "dots" ? 24 : 32;
  ctx.strokeStyle = "#e5e7eb";
  ctx.fillStyle = "#cbd5e1";
  ctx.lineWidth = 1 / z;
  const minX = -w / z - 100,
    maxX = w / z + 100,
    minY = -h / z - 100,
    maxY = h / z + 100;
  if (b === "dots") {
    for (let x = minX; x < maxX; x += span)
      for (let y = minY; y < maxY; y += span) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 / z, 0, 7);
        ctx.fill();
      }
  } else
    for (let x = minX; x < maxX; x += span) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x, maxY);
      ctx.stroke();
    }
  if (b === "grid")
    for (let y = minY; y < maxY; y += span) {
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
  if (b === "lines")
    for (let y = minY; y < maxY; y += span) {
      ctx.beginPath();
      ctx.moveTo(minX, y);
      ctx.lineTo(maxX, y);
      ctx.stroke();
    }
}
function drawObject(ctx: CanvasRenderingContext2D, o: NoteObject) {
  if (o.type === "stroke") {
    if (o.points.length < 2) return;
    ctx.strokeStyle = o.color;
    ctx.lineWidth = o.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(o.points[0].x, o.points[0].y);
    for (let i = 1; i < o.points.length; i++)
      ctx.lineTo(o.points[i].x, o.points[i].y);
    ctx.stroke();
  } else if (o.type === "text") {
    ctx.fillStyle = "#202124";
    ctx.font = `${o.size}px -apple-system,BlinkMacSystemFont,sans-serif`;
    ctx.fillText(o.text, o.x, o.y);
  } else {
    const img = new Image();
    img.src = o.data;
    ctx.drawImage(img, o.x, o.y, o.width, o.height);
  }
}
