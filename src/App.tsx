import { useEffect, useRef, useState } from "react";
import { loadNotes, loadSettings, saveNotes, saveSettings } from "./db";
import {
  Note,
  NoteObject,
  Tool,
  Settings,
  Background,
  Stroke,
  Point,
  ImageObject,
} from "./types";
import { renderCanvas, worldPoint } from "./canvasEngine";

const uid = () => crypto.randomUUID();
const palettes = [
  "#202124",
  "#5f6368",
  "#d93025",
  "#f29900",
  "#fbbc04",
  "#188038",
  "#00a5b5",
  "#1a73e8",
  "#7e57c2",
  "#e91e63",
];
const bgLabels: Record<Background, string> = {
  plain: "白紙",
  grid: "方眼",
  dots: "ドット",
  lines: "横罫線",
};
function newNote(settings: Settings, n: number): Note {
  return {
    id: uid(),
    name: `新規ノート ${n}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    background: settings.defaultBackground,
    viewport: { x: 0, y: 0, zoom: 1 },
    objects: [],
  };
}
function objectBounds(o: NoteObject) {
  if (o.type === "stroke") {
    const xs = o.points.map((p) => p.x),
      ys = o.points.map((p) => p.y);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }
  if (o.type === "image")
    return { x: o.x, y: o.y, width: o.width, height: o.height };
  return {
    x: o.x,
    y: o.y - o.size,
    width: Math.max(12, o.text.length * o.size * 0.55),
    height: o.size,
  };
}
function splitErased(stroke: Stroke, eraser: Point[], radius: number) {
  const parts: Stroke[] = [];
  let part: Point[] = [];
  for (const p of stroke.points) {
    const hit = eraser.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < radius);
    if (hit) {
      if (part.length > 1) parts.push({ ...stroke, id: uid(), points: part });
      part = [];
    } else part.push(p);
  }
  if (part.length > 1) parts.push({ ...stroke, id: uid(), points: part });
  return parts;
}
function downloadFile(name: string, data: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function backupPayload(notes: Note[]) {
  return JSON.stringify(
    {
      format: "paperline.notebook",
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
    },
    null,
    2,
  );
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]),
    [settings, setSettings] = useState<Settings>({
      theme: "light",
      defaultBackground: "plain",
      smoothing: "standard",
      color: "#202124",
      width: 3,
      favorites: [],
      lastTool: "pen",
    }),
    [active, setActive] = useState<string | null>(null),
    [trash, setTrash] = useState(false),
    [query, setQuery] = useState(""),
    [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    Promise.all([loadNotes(), loadSettings()]).then(([n, s]) => {
      setNotes(n);
      setSettings(s);
      if (s.lastNoteId && n.some((x) => x.id === s.lastNoteId && !x.trashed))
        setActive(s.lastNoteId);
    });
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      saveNotes(notes);
      saveSettings(settings);
    }, 900);
    return () => clearTimeout(t);
  }, [notes, settings]);
  const current = notes.find((n) => n.id === active);
  const visible = notes
    .filter(
      (n) =>
        !!n.trashed === trash &&
        n.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const create = () => {
    const n = newNote(
      settings,
      notes.filter((x) => x.name.startsWith("新規ノート")).length + 1,
    );
    setNotes((v) => [...v, n]);
    setSettings((s) => ({ ...s, lastNoteId: n.id }));
    setActive(n.id);
  };
  const update = (n: Note) =>
    setNotes((v) => v.map((x) => (x.id === n.id ? n : x)));
  if (current && !current.trashed)
    return (
      <Editor
        note={current}
        settings={settings}
        setSettings={setSettings}
        onUpdate={update}
        onBack={() => {
          setActive(null);
          setSettings((s) => ({ ...s, lastNoteId: undefined }));
        }}
      />
    );
  return (
    <div className={`app ${settings.theme}`}>
      <header className="app-header">
        <div>
          <div className="eyebrow">LOCAL NOTEBOOK</div>
          <h1>Paperline</h1>
        </div>
        <div className="header-actions">
          <button
            className="icon-button"
            onClick={() => setShowSettings(true)}
            aria-label="設定"
          >
            ⚙
          </button>
          <button className="primary" onClick={create}>
            ＋ 新規ノート
          </button>
        </div>
      </header>
      <main className="library">
        <div className="library-top">
          <div>
            <h2>{trash ? "ゴミ箱" : "ノート一覧"}</h2>
            <p>
              {trash ? "削除したノートを管理" : "軽く、静かに、ローカルで。"}
            </p>
          </div>
          <div className="segmented">
            <button
              className={!trash ? "active" : ""}
              onClick={() => setTrash(false)}
            >
              ノート
            </button>
            <button
              className={trash ? "active" : ""}
              onClick={() => setTrash(true)}
            >
              ゴミ箱
            </button>
          </div>
        </div>
        <label className="search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ノート名を検索"
          />
        </label>
        <div className="note-list">
          {visible.map((n) => (
            <div
              className="note-row"
              key={n.id}
              onClick={() =>
                !trash &&
                (setActive(n.id),
                setSettings((s) => ({ ...s, lastNoteId: n.id })))
              }
            >
              <div className="note-mark">✎</div>
              <div className="note-meta">
                <strong>{n.name}</strong>
                <span>
                  更新{" "}
                  {new Date(n.updatedAt).toLocaleString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="row-actions">
                {trash ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        update({ ...n, trashed: false, updatedAt: Date.now() });
                      }}
                    >
                      復元
                    </button>
                    <button
                      className="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("このノートを完全に削除しますか？"))
                          setNotes((v) => v.filter((x) => x.id !== n.id));
                      }}
                    >
                      完全削除
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = prompt("ノート名", n.name);
                        if (name?.trim())
                          update({
                            ...n,
                            name: name.trim(),
                            updatedAt: Date.now(),
                          });
                      }}
                    >
                      名前変更
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(`${n.name}.notebook`, backupPayload([n]));
                      }}
                    >
                      書き出す
                    </button>
                    <button
                      className="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        update({ ...n, trashed: true, updatedAt: Date.now() });
                      }}
                    >
                      ゴミ箱
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!visible.length && (
            <div className="empty">
              <div>□</div>
              <p>{trash ? "ゴミ箱は空です" : "ノートがありません"}</p>
              <span>{trash ? "" : "新規ノートを作成して始めましょう"}</span>
            </div>
          )}
        </div>
      </main>
      {showSettings && (
        <SettingsModal
          notes={notes}
          setNotes={setNotes}
          settings={settings}
          setSettings={setSettings}
          close={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function moveObject(o: NoteObject, dx: number, dy: number): NoteObject {
  if (o.type === "stroke")
    return {
      ...o,
      points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
    };
  return { ...o, x: o.x + dx, y: o.y + dy };
}
function Editor({
  note,
  settings,
  setSettings,
  onUpdate,
  onBack,
}: {
  note: Note;
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  onUpdate: (n: Note) => void;
  onBack: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [tool, setTool] = useState<Tool>(settings.lastTool),
    [penOpen, setPenOpen] = useState(false),
    [renaming, setRenaming] = useState(false),
    [name, setName] = useState(note.name),
    [history, setHistory] = useState<Note[]>([]),
    [future, setFuture] = useState<Note[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    activeStroke = useRef<Stroke | null>(null),
    eraserPath = useRef<Point[]>([]),
    dragStart = useRef<Point | null>(null),
    resizeStart = useRef<{ object: ImageObject; point: Point } | null>(null),
    touches = useRef(new Map<number, { x: number; y: number }>()),
    lastCenter = useRef<Point | null>(null),
    lastDist = useRef(0);
  const commit = (next: Note) => {
    setHistory((h) => [...h.slice(-99), note]);
    setFuture([]);
    onUpdate({ ...next, updatedAt: Date.now() });
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const draw = () => renderCanvas(c, note);
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [note]);
  const onDown = (e: React.PointerEvent) => {
    const c = canvas.current!;
    c.setPointerCapture(e.pointerId);
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = worldPoint(e.nativeEvent, c, note.viewport);
    if (e.pointerType === "pen" && tool === "pen") {
      activeStroke.current = {
        id: uid(),
        type: "stroke",
        points: [p],
        color: settings.color,
        width: settings.width,
        smoothing: settings.smoothing,
      };
      return;
    }
    if (e.pointerType === "pen" && tool === "eraser") {
      eraserPath.current = [p];
      return;
    }
    if (e.pointerType === "pen" && tool === "select") {
      const hit = note.objects
        .slice()
        .reverse()
        .find((o) => {
          const b = objectBounds(o);
          return (
            p.x >= b.x - 12 &&
            p.x <= b.x + b.width + 12 &&
            p.y >= b.y - 12 &&
            p.y <= b.y + b.height + 12
          );
        });
      if (hit) {
        setSelected((s) => (s.includes(hit.id) ? s : [hit.id]));
        const b = objectBounds(hit);
        if (
          hit.type === "image" &&
          Math.hypot(p.x - (b.x + b.width), p.y - (b.y + b.height)) < 24
        )
          resizeStart.current = { object: hit, point: p };
        else dragStart.current = p;
      } else setSelected([]);
      return;
    }
    if (e.pointerType === "touch" && touches.current.size === 1)
      lastCenter.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: React.PointerEvent) => {
    const c = canvas.current!;
    const p = worldPoint(e.nativeEvent, c, note.viewport);
    if (activeStroke.current) {
      activeStroke.current.points.push(p);
      renderCanvas(c, {
        ...note,
        objects: [...note.objects, activeStroke.current],
      });
      return;
    }
    if (tool === "eraser" && e.pointerType === "pen") {
      eraserPath.current.push(p);
      return;
    }
    if (tool === "select" && resizeStart.current && e.pointerType === "pen") {
      const start = resizeStart.current,
        ratio = start.object.width / start.object.height;
      const width = Math.max(20, p.x - start.object.x),
        height = width / ratio;
      onUpdate({
        ...note,
        objects: note.objects.map((o) =>
          o.id === start.object.id && o.type === "image"
            ? { ...o, width, height }
            : o,
        ),
      });
      return;
    }
    if (tool === "select" && dragStart.current && e.pointerType === "pen") {
      const dx = p.x - dragStart.current.x,
        dy = p.y - dragStart.current.y;
      onUpdate({
        ...note,
        objects: note.objects.map((o) =>
          selected.includes(o.id) ? moveObject(o, dx, dy) : o,
        ),
      });
      dragStart.current = p;
      return;
    }
    if (e.pointerType === "touch") {
      const pts = [...touches.current.values()];
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.length >= 2) {
        const all = [...touches.current.values()],
          center = {
            x: (all[0].x + all[1].x) / 2,
            y: (all[0].y + all[1].y) / 2,
          },
          dist = Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y);
        if (lastCenter.current) {
          const dx = center.x - lastCenter.current.x,
            dy = center.y - lastCenter.current.y;
          const zoom = Math.min(
            4,
            Math.max(
              0.25,
              note.viewport.zoom *
                (lastDist.current ? dist / lastDist.current : 1),
            ),
          );
          onUpdate({
            ...note,
            viewport: {
              x: note.viewport.x + dx / zoom,
              y: note.viewport.y + dy / zoom,
              zoom,
            },
          });
        }
        lastCenter.current = center;
        lastDist.current = dist;
      } else if (lastCenter.current) {
        const dx = e.clientX - lastCenter.current.x,
          dy = e.clientY - lastCenter.current.y;
        onUpdate({
          ...note,
          viewport: {
            ...note.viewport,
            x: note.viewport.x + dx / note.viewport.zoom,
            y: note.viewport.y + dy / note.viewport.zoom,
          },
        });
        lastCenter.current = { x: e.clientX, y: e.clientY };
      }
    }
  };
  const onUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (activeStroke.current) {
      commit({ ...note, objects: [...note.objects, activeStroke.current] });
      activeStroke.current = null;
    }
    if (tool === "eraser" && eraserPath.current.length) {
      const path = eraserPath.current;
      const objects: NoteObject[] = note.objects.flatMap((o): NoteObject[] =>
        o.type === "stroke" ? splitErased(o, path, settings.width * 3) : [o],
      );
      commit({ ...note, objects });
      eraserPath.current = [];
    }
    if (resizeStart.current) {
      setHistory((h) => [...h, note]);
      setFuture([]);
      resizeStart.current = null;
    }
    dragStart.current = null;
    if (!touches.current.size) {
      lastCenter.current = null;
      lastDist.current = 0;
    }
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setFuture((f) => [note, ...f]);
      onUpdate(prev);
    }
  };
  const redo = () => {
    const next = future[0];
    if (next) {
      setFuture((f) => f.slice(1));
      setHistory((h) => [...h, note]);
      onUpdate(next);
    }
  };
  const addText = () => {
    const text = prompt("テキスト");
    if (text?.trim())
      commit({
        ...note,
        objects: [
          ...note.objects,
          {
            id: uid(),
            type: "text",
            x: -100 - note.viewport.x,
            y: -20 - note.viewport.y,
            text: text.trim(),
            size: 24,
          },
        ],
      });
  };
  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 2048 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = img.width * scale;
        c.height = img.height * scale;
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        commit({
          ...note,
          objects: [
            ...note.objects,
            {
              id: uid(),
              type: "image",
              x: -c.width / 2 - note.viewport.x,
              y: -c.height / 2 - note.viewport.y,
              width: c.width,
              height: c.height,
              data: c.toDataURL("image/webp", 0.86),
            },
          ],
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="editor">
      <div className="toolbar">
        <button className="back" onClick={onBack}>
          ‹
        </button>
        <button
          className="export-note"
          onClick={() => downloadFile(`${note.name}.notebook`, backupPayload([note]))}
          aria-label="ノートを書き出す"
        >
          ⇩
        </button>
        <div className="title-wrap">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                setRenaming(false);
                if (name.trim())
                  onUpdate({
                    ...note,
                    name: name.trim(),
                    updatedAt: Date.now(),
                  });
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          ) : (
            <button className="title" onClick={() => setRenaming(true)}>
              {note.name}
              <span>⌄</span>
            </button>
          )}
        </div>
        <div className="tool-group">
          <button onClick={undo} disabled={!history.length}>
            ↶
          </button>
          <button onClick={redo} disabled={!future.length}>
            ↷
          </button>
          <button
            className={tool === "pen" ? "selected" : ""}
            onClick={() => {
              setTool("pen");
              setSettings((s) => ({ ...s, lastTool: "pen" }));
              setPenOpen(!penOpen);
            }}
          >
            ✎
          </button>
          <button
            className={tool === "eraser" ? "selected" : ""}
            onClick={() => setTool("eraser")}
          >
            ⌫
          </button>
          <button
            className={tool === "select" ? "selected" : ""}
            onClick={() => setTool("select")}
          >
            ⌁
          </button>
          <button onClick={addText}>T</button>
          <label className="tool-button">
            ▧<input type="file" accept="image/*" onChange={addImage} />
          </label>
        </div>
      </div>
      {penOpen && (
        <div className="pen-pop">
          <div className="pop-title">ペン設定</div>
          <div className="width-row">
            <span>太さ</span>
            {[2, 4, 8, 14].map((w) => (
              <button
                key={w}
                className={settings.width === w ? "active" : ""}
                onClick={() => setSettings((s) => ({ ...s, width: w }))}
              >
                {w}
              </button>
            ))}
            <input
              type="range"
              min="1"
              max="20"
              value={settings.width}
              onChange={(e) =>
                setSettings((s) => ({ ...s, width: +e.target.value }))
              }
            />
          </div>
          <div className="swatches">
            {palettes.map((c) => (
              <button
                key={c}
                style={{ background: c }}
                className={settings.color === c ? "active" : ""}
                onClick={() => setSettings((s) => ({ ...s, color: c }))}
              />
            ))}
          </div>
          <div className="smooth">
            <span>スムージング</span>
            {(["none", "standard", "strong"] as const).map((v) => (
              <button
                key={v}
                className={settings.smoothing === v ? "active" : ""}
                onClick={() => setSettings((s) => ({ ...s, smoothing: v }))}
              >
                {v === "none" ? "なし" : v === "standard" ? "標準" : "強"}
              </button>
            ))}
          </div>
        </div>
      )}
      <canvas
        ref={canvas}
        className={`canvas ${tool}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div className="status">
        {Math.round(note.viewport.zoom * 100)}% · {bgLabels[note.background]} ·{" "}
        {note.objects.length} objects
      </div>
    </div>
  );
}
function SettingsModal({
  notes,
  setNotes,
  settings,
  setSettings,
  close,
}: {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  settings: Settings;
  setSettings: (f: (s: Settings) => Settings) => void;
  close: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed.notes)) throw new Error();
        setNotes(parsed.notes);
        alert(`${parsed.notes.length}件のノートを復元しました`);
        close();
      } catch {
        alert("バックアップ形式を読み込めませんでした");
      }
    };
    reader.readAsText(file);
  };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>設定</h2>
          <button onClick={close}>×</button>
        </div>
        <label>
          テーマ
          <select
            value={settings.theme}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                theme: e.target.value as "light" | "dark",
              }))
            }
          >
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </label>
        <label>
          新規ノートの背景
          <select
            value={settings.defaultBackground}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                defaultBackground: e.target.value as Background,
              }))
            }
          >
            {Object.entries(bgLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="backup-section">
          <strong>バックアップ</strong>
          <div className="backup-actions">
            <button
              onClick={() =>
                downloadFile("paperline-all.notebook", backupPayload(notes))
              }
            >
              全ノートを書き出す
            </button>
            <button onClick={() => input.current?.click()}>読み込む</button>
            <input
              ref={input}
              type="file"
              accept=".notebook,application/json"
              onChange={importBackup}
            />
          </div>
        </div>
        <p className="local-note">
          データはこの端末のIndexedDBにのみ保存されます。サーバーへの送信・アカウント・同期はありません。
        </p>
      </div>
    </div>
  );
}
