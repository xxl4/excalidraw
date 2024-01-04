import {
  ExcalidrawElement,
  FontFamilyValues,
} from "../excalidraw/element/types";

export const IMAGE_MIME_TYPES = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  jfif: "image/jfif",
} as const;

export const MIME_TYPES = {
  json: "application/json",
  // excalidraw data
  excalidraw: "application/vnd.excalidraw+json",
  excalidrawlib: "application/vnd.excalidrawlib+json",
  // image-encoded excalidraw data
  "excalidraw.svg": "image/svg+xml",
  "excalidraw.png": "image/png",
  // binary
  binary: "application/octet-stream",
  // image
  ...IMAGE_MIME_TYPES,
} as const;

export const EXPORT_DATA_TYPES = {
  excalidraw: "excalidraw",
  excalidrawClipboard: "excalidraw/clipboard",
  excalidrawLibrary: "excalidrawlib",
  excalidrawClipboardWithAPI: "excalidraw-api/clipboard",
} as const;

export const ROUGHNESS = {
  architect: 0,
  artist: 1,
  cartoonist: 2,
} as const;

export const DEFAULT_ELEMENT_PROPS: {
  strokeColor: ExcalidrawElement["strokeColor"];
  backgroundColor: ExcalidrawElement["backgroundColor"];
  fillStyle: ExcalidrawElement["fillStyle"];
  strokeWidth: ExcalidrawElement["strokeWidth"];
  strokeStyle: ExcalidrawElement["strokeStyle"];
  roughness: ExcalidrawElement["roughness"];
  opacity: ExcalidrawElement["opacity"];
  locked: ExcalidrawElement["locked"];
} = {
  // Not using color palette to avoid whole color palette being imported
  strokeColor: "#1e1e1e",
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: ROUGHNESS.artist,
  opacity: 100,
  locked: false,
};

// 1-based in case we ever do `if(element.fontFamily)`
export const FONT_FAMILY = {
  Virgil: 1,
  Helvetica: 2,
  Cascadia: 3,
  Assistant: 4,
};

export const DEFAULT_FONT_SIZE = 20;
export const DEFAULT_FONT_FAMILY: FontFamilyValues = FONT_FAMILY.Virgil;
export const DEFAULT_TEXT_ALIGN = "left";
export const EXPORT_SCALES = [1, 2, 3];
export const THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;
