export type Background = "plain" | "grid" | "dots" | "lines";
export type Tool = "pen" | "eraser" | "select" | "text" | "image";
export type Point = { x: number; y: number };
export type Stroke = {
  id: string;
  type: "stroke";
  points: Point[];
  color: string;
  width: number;
  smoothing: "none" | "standard" | "strong";
};
export type TextObject = {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  size: number;
};
export type ImageObject = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  data: string;
};
export type NoteObject = Stroke | TextObject | ImageObject;
export type Note = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  background: Background;
  viewport: { x: number; y: number; zoom: number };
  objects: NoteObject[];
  trashed?: boolean;
};
export type Settings = {
  theme: "light" | "dark";
  defaultBackground: Background;
  smoothing: "none" | "standard" | "strong";
  color: string;
  width: number;
  favorites: string[];
  lastNoteId?: string;
  lastTool: Tool;
};
