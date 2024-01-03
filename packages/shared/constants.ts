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
