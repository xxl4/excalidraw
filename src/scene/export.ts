import rough from "roughjs/bin/rough";
import { NonDeletedExcalidrawElement, Theme } from "../element/types";
import { getCommonBounds, getElementAbsoluteCoords } from "../element/bounds";
import { renderStaticScene, renderSceneToSvg } from "../renderer/renderScene";
import { distance, isOnlyExportingSingleFrame } from "../utils";
import { AppState, BinaryFiles } from "../types";
import {
  DEFAULT_BACKGROUND_COLOR,
  DEFAULT_EXPORT_PADDING,
  DEFAULT_ZOOM_VALUE,
  ENV,
  SVG_NS,
  THEME,
  THEME_FILTER,
} from "../constants";
import { serializeAsJSON } from "../data/json";
import {
  getInitializedImageElements,
  updateImageCache,
} from "../element/image";
import { restoreAppState } from "../data/restore";
import Scene from "./Scene";

export const SVG_EXPORT_TAG = `<!-- svg-source:excalidraw -->`;

export type ExportToCanvasData = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState?: Partial<Omit<AppState, "offsetTop" | "offsetLeft">>;
  files: BinaryFiles | null;
};

export type ExportToCanvasConfig = {
  theme?: Theme;
  /**
   * Canvas background. Valid values are:
   *
   * - `undefined` - the background of "appState.viewBackgroundColor" is used.
   * - `false` - no background is used (set to "transparent").
   * - `string` - should be a valid CSS color.
   *
   * @default undefined
   */
  canvasBackgroundColor?: string | false;
  /**
   * Canvas padding in pixels. Affected by `scale`.
   *
   * When `fit` is set to `none`, padding is added to the content bounding box
   * (including if you set `width` or `height` or `maxWidthOrHeight` or
   * `widthOrHeight`).
   *
   * When `fit` set to `contain`, padding is subtracted from the content
   * bounding box (ensuring the size doesn't exceed the supplied values, with
   * the exeception of using alongside `scale` as noted above), and the padding
   * serves as a minimum distance between the content and the canvas edges, as
   * it may exceed the supplied padding value from one side or the other in
   * order to maintain the aspect ratio. It is recommended to set `position`
   * to `center` when using `fit=contain`.
   *
   * When `fit` is set to `cover`, padding is disabled (set to 0).
   *
   * When `fit` is set to `none` and either `width` or `height` or
   * `maxWidthOrHeight` is set, padding is simply adding to the bounding box
   * and the content may overflow the canvas, thus right or bottom padding
   * may be ignored.
   *
   * @default 0
   */
  padding?: number;
  // -------------------------------------------------------------------------
  /**
   * Makes sure the canvas content fits into a frame of width/height no larger
   * than this value, while maintaining the aspect ratio.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   */
  maxWidthOrHeight?: number;
  /**
   * Scale the canvas content to be excatly this many pixels wide/tall,
   * maintaining the aspect ratio.
   *
   * Cannot be used in conjunction with `maxWidthOrHeight`.
   *
   * Final dimensions can get smaller/larger if used in conjunction with
   * `scale`.
   */
  widthOrHeight?: number;
  // -------------------------------------------------------------------------
  /**
   * Width of the frame. Supply `x` or `y` if you want to ofsset the canvas
   * content.
   *
   * If `width` omitted but `height` supplied, `width` is calculated from the
   * the content's bounding box to preserve the aspect ratio.
   *
   * Defaults to the content bounding box width when both `width` and `height`
   * are omitted.
   */
  width?: number;
  /**
   * Height of the frame.
   *
   * If `height` omitted but `width` supplied, `height` is calculated from the
   * content's bounding box to preserve the aspect ratio.
   *
   * Defaults to the content bounding box height when both `width` and `height`
   * are omitted.
   */
  height?: number;
  /**
   * Left canvas offset. By default the coordinate is relative to the canvas.
   * You can switch to content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `x` postion of the content bounding box.
   */
  x?: number;
  /**
   * Top canvas offset. By default the coordinate is relative to the canvas.
   * You can switch to content coordinates by setting `origin` to `content`.
   *
   * Defaults to the `y` postion of the content bounding box.
   */
  y?: number;
  /**
   * Indicates the coordinate system of the `x` and `y` values.
   *
   * - `canvas` - `x` and `y` are relative to the canvas [0, 0] position.
   * - `content` - `x` and `y` are relative to the content bounding box.
   *
   * @default "canvas"
   */
  origin?: "canvas" | "content";
  /**
   * If dimensions specified and `x` and `y` are not specified, this indicates
   * how the canvas should be scaled.
   *
   * Behavior aligns with the `object-fit` CSS property.
   *
   * - `none`    - no scaling.
   * - `contain` - scale to fit the frame. Includes `padding`.
   * - `cover`   - scale to fill the frame while maintaining aspect ratio. If
   *               content overflows, it will be cropped.
   *
   * If `maxWidthOrHeight` or `widthOrHeight` is set, `fit` is ignored.
   *
   * @default "contain" unless `width`, `height`, `maxWidthOrHeight`, or
   * `widthOrHeight` is specified in which case `none` is the default (can be
   * changed). If `x` or `y` are specified, `none` is forced.
   */
  fit?: "none" | "contain" | "cover";
  /**
   * When either `x` or `y` are not specified, indicates how the canvas should
   * be aligned on the respective axis.
   *
   * - `none`   - canvas aligned to top left.
   * - `center` - canvas is centered on the axis which is not specified
   *              (or both).
   *
   * If `maxWidthOrHeight` or `widthOrHeight` is set, `position` is ignored.
   *
   * @default "center"
   */
  position?: "center" | "topLeft";
  // -------------------------------------------------------------------------
  /**
   * A multiplier to increase/decrease the frame dimensions
   * (content resolution).
   *
   * For example, if your canvas is 300x150 and you set scale to 2, the
   * resulting size will be 600x300.
   *
   * @default 1
   */
  scale?: number;
  /**
   * If you need to suply your own canvas, e.g. in test environments or in
   * Node.js.
   *
   * Do not set `canvas.width/height` or modify the canvas context as that's
   * handled by Excalidraw.
   *
   * Defaults to `document.createElement("canvas")`.
   */
  createCanvas?: () => HTMLCanvasElement;
  /**
   * If you want to supply `width`/`height` dynamically (or derive from the
   * content bounding box), you can use this function.
   *
   * Ignored if `maxWidthOrHeight`, `width`, or `height` is set.
   */
  getDimensions?: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale?: number };
};

/**
 * This API is usually used as a precursor to searializing to Blob or PNG,
 * but can also be used to create a canvas for other purposes.
 */
export const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToCanvasConfig;
}) => {
  // initialize defaults
  // ---------------------------------------------------------------------------
  const { elements, files } = data;

  const appState = restoreAppState(data.appState, null);

  // clone
  const cfg = Object.assign({}, config);

  cfg.fit =
    cfg.fit ??
    (cfg.width != null ||
    cfg.height != null ||
    cfg.maxWidthOrHeight != null ||
    cfg.widthOrHeight != null
      ? "contain"
      : "none");

  const containPadding = cfg.fit === "contain";

  if (cfg.x != null || cfg.x != null) {
    cfg.fit = "none";
  }

  if (cfg.fit === "cover") {
    if (cfg.padding && process.env.NODE_ENV !== ENV.PRODUCTION) {
      console.warn("`padding` is ignored when `fit` is set to `cover`");
    }
    cfg.padding = 0;
  }

  cfg.padding = cfg.padding ?? 0;
  cfg.scale = cfg.scale ?? 1;

  cfg.origin = cfg.origin ?? "canvas";
  cfg.position = cfg.position ?? "center";

  if (cfg.maxWidthOrHeight != null && cfg.widthOrHeight != null) {
    if (process.env.NODE_ENV !== ENV.PRODUCTION) {
      console.warn("`maxWidthOrHeight` is ignored when `widthOrHeight` is set");
    }
    cfg.maxWidthOrHeight = undefined;
  }

  if (
    (cfg.maxWidthOrHeight != null || cfg.width != null || cfg.height != null) &&
    cfg.getDimensions
  ) {
    if (process.env.NODE_ENV !== ENV.PRODUCTION) {
      console.warn(
        "`getDimensions` is ignored when `width`, `height`, or `maxWidthOrHeight` is set",
      );
    }
    cfg.getDimensions = undefined;
  }
  // ---------------------------------------------------------------------------

  // value used to scale the canvas context. By default, we use this to
  // make the canvas fit into the frame (e.g. for `cfg.fit` set to `contain`).
  // If `cfg.scale` is set, we multiply the resulting canvasScale by it to
  // scale the output further.
  let canvasScale = 1;

  const origCanvasSize = getCanvasSize(elements);

  // cfg.x = undefined;
  // cfg.y = undefined;

  // variables for original content bounding box
  const [origX, origY, origWidth, origHeight] = origCanvasSize;
  // variables for target bounding box
  let [x, y, width, height] = origCanvasSize;

  if (cfg.width != null) {
    width = cfg.width;

    if (cfg.padding && containPadding) {
      width -= cfg.padding * 2;
    }

    if (cfg.height) {
      height = cfg.height;
      if (cfg.padding && containPadding) {
        height -= cfg.padding * 2;
      }
    } else {
      // if height not specified, scale the original height to match the new
      // width while maintaining aspect ratio
      height *= width / origWidth;
    }
  } else if (cfg.height != null) {
    height = cfg.height;

    if (cfg.padding && containPadding) {
      height -= cfg.padding * 2;
    }
    // width not specified, so scale the original width to match the new
    // height while maintaining aspect ratio
    width *= height / origHeight;
  }

  if (cfg.maxWidthOrHeight != null || cfg.widthOrHeight != null) {
    if (containPadding && cfg.padding) {
      if (cfg.maxWidthOrHeight != null) {
        cfg.maxWidthOrHeight -= cfg.padding * 2;
      } else if (cfg.widthOrHeight != null) {
        cfg.widthOrHeight -= cfg.padding * 2;
      }
    }

    const max = Math.max(width, height);
    if (cfg.widthOrHeight != null) {
      // calculate by how much do we need to scale the canvas to fit into the
      // target dimension (e.g. target: max 50px, actual: 70x100px => scale: 0.5)
      canvasScale = cfg.widthOrHeight / max;
    } else if (cfg.maxWidthOrHeight != null) {
      canvasScale = cfg.maxWidthOrHeight < max ? cfg.maxWidthOrHeight / max : 1;
    }

    width *= canvasScale;
    height *= canvasScale;
  } else if (cfg.getDimensions) {
    const ret = cfg.getDimensions(width, height);

    width = ret.width;
    height = ret.height;
    cfg.scale = ret.scale ?? cfg.scale;
  } else if (
    containPadding &&
    cfg.padding &&
    cfg.width == null &&
    cfg.height == null
  ) {
    const whRatio = width / height;
    width -= cfg.padding * 2;
    height -= (cfg.padding * 2) / whRatio;
  }

  if (
    (cfg.fit === "contain" && !cfg.maxWidthOrHeight) ||
    (containPadding && cfg.padding)
  ) {
    if (cfg.fit === "contain") {
      const wRatio = width / origWidth;
      const hRatio = height / origHeight;
      // scale the orig canvas to fit in the target frame
      canvasScale = Math.min(wRatio, hRatio);
    } else {
      const wRatio = (width - cfg.padding * 2) / width;
      const hRatio = (height - cfg.padding * 2) / height;
      canvasScale = Math.min(wRatio, hRatio);
    }
  } else if (cfg.fit === "cover") {
    const wRatio = width / origWidth;
    const hRatio = height / origHeight;
    // scale the orig canvas to fill the the target frame
    // (opposite of "contain")
    canvasScale = Math.max(wRatio, hRatio);
  }

  x = cfg.x ?? origX;
  y = cfg.y ?? origY;

  // if we switch to "content" coords, we need to offset cfg-supplied
  // coords by the x/y of content bounding box
  if (cfg.origin === "content") {
    if (cfg.x != null) {
      x += origX;
    }
    if (cfg.y != null) {
      y += origY;
    }
  }

  // Centering the content to the frame.
  // We divide width/height by canvasScale so that we calculate in the original
  // aspect ratio dimensions.
  if (cfg.position === "center") {
    x -=
      width / canvasScale / 2 -
      (cfg.x == null ? origWidth : width + cfg.padding * 2) / 2;
    y -=
      height / canvasScale / 2 -
      (cfg.y == null ? origHeight : height + cfg.padding * 2) / 2;
  }

  const canvas = cfg.createCanvas
    ? cfg.createCanvas()
    : document.createElement("canvas");

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  // hack fix until we decide whose responsibility this should be
  if (onlyExportingSingleFrame) {
    cfg.padding = 0;
  }

  // rescale padding based on current canvasScale factor so that the resulting
  // padding is kept the same as supplied by user (with the exception of
  // `cfg.scale` being set, which also scales the padding)
  const normalizedPadding = cfg.padding / canvasScale;

  // scale the whole frame by cfg.scale (on top of whatever canvasScale we
  // calculated above)
  canvasScale *= cfg.scale;

  width *= cfg.scale;
  height *= cfg.scale;

  canvas.width = width + cfg.padding * 2 * cfg.scale;
  canvas.height = height + cfg.padding * 2 * cfg.scale;

  const { imageCache } = await updateImageCache({
    imageCache: new Map(),
    fileIds: getInitializedImageElements(elements).map(
      (element) => element.fileId,
    ),
    files: files || {},
  });

  // console.log(elements, width, height, cfg, canvasScale);

  renderStaticScene({
    elements,
    visibleElements: elements,
    appState: {
      ...appState,
      width,
      height,
      offsetLeft: 0,
      offsetTop: 0,
      scrollX: -x + normalizedPadding,
      scrollY: -y + normalizedPadding,
      zoom: { value: DEFAULT_ZOOM_VALUE },
      shouldCacheIgnoreZoom: false,
      theme: cfg.theme || THEME.LIGHT,
    },
    rc: rough.canvas(canvas),
    canvas,
    scale: canvasScale,
    renderConfig: {
      canvasBackgroundColor:
        cfg.canvasBackgroundColor === false
          ? // null indicates transparent background
            null
          : cfg.canvasBackgroundColor ||
            appState.viewBackgroundColor ||
            DEFAULT_BACKGROUND_COLOR,

      imageCache,
      renderGrid: false,
      isExporting: true,
    },
  });

  return canvas;
};

export const exportToSvg = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: {
    exportBackground: boolean;
    exportPadding?: number;
    exportScale?: number;
    viewBackgroundColor: string;
    exportWithDarkMode?: boolean;
    exportEmbedScene?: boolean;
    renderFrame?: boolean;
  },
  files: BinaryFiles | null,
  opts?: {
    serializeAsJSON?: () => string;
    renderEmbeddables?: boolean;
  },
): Promise<SVGSVGElement> => {
  const {
    exportPadding = DEFAULT_EXPORT_PADDING,
    viewBackgroundColor,
    exportScale = 1,
    exportEmbedScene,
  } = appState;
  let metadata = "";
  if (exportEmbedScene) {
    try {
      metadata = await (
        await import(/* webpackChunkName: "image" */ "../../src/data/image")
      ).encodeSvgMetadata({
        text: opts?.serializeAsJSON
          ? opts?.serializeAsJSON?.()
          : serializeAsJSON(elements, appState, files || {}, "local"),
      });
    } catch (error: any) {
      console.error(error);
    }
  }
  let [minX, minY, width, height] = getCanvasSize(elements);

  width += exportPadding * 2;
  height += exportPadding * 2;

  // initialize SVG root
  const svgRoot = document.createElementNS(SVG_NS, "svg");
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", SVG_NS);
  svgRoot.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svgRoot.setAttribute("width", `${width * exportScale}`);
  svgRoot.setAttribute("height", `${height * exportScale}`);
  if (appState.exportWithDarkMode) {
    svgRoot.setAttribute("filter", THEME_FILTER);
  }

  let assetPath = "https://excalidraw.com/";
  // Asset path needs to be determined only when using package
  if (import.meta.env.VITE_IS_EXCALIDRAW_NPM_PACKAGE) {
    assetPath =
      window.EXCALIDRAW_ASSET_PATH ||
      `https://unpkg.com/${import.meta.env.VITE_PKG_NAME}@${
        import.meta.env.PKG_VERSION
      }`;

    if (assetPath?.startsWith("/")) {
      assetPath = assetPath.replace("/", `${window.location.origin}/`);
    }
    assetPath = `${assetPath}/dist/excalidraw-assets/`;
  }

  // do not apply clipping when we're exporting the whole scene
  const isExportingWholeCanvas =
    Scene.getScene(elements[0])?.getNonDeletedElements()?.length ===
    elements.length;

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  const offsetX = -minX + (onlyExportingSingleFrame ? 0 : exportPadding);
  const offsetY = -minY + (onlyExportingSingleFrame ? 0 : exportPadding);

  const exportingFrame =
    isExportingWholeCanvas || !onlyExportingSingleFrame
      ? undefined
      : elements.find((element) => element.type === "frame");

  let exportingFrameClipPath = "";
  if (exportingFrame) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(exportingFrame);
    const cx = (x2 - x1) / 2 - (exportingFrame.x - x1);
    const cy = (y2 - y1) / 2 - (exportingFrame.y - y1);

    exportingFrameClipPath = `<clipPath id=${exportingFrame.id}>
            <rect transform="translate(${exportingFrame.x + offsetX} ${
      exportingFrame.y + offsetY
    }) rotate(${exportingFrame.angle} ${cx} ${cy})"
          width="${exportingFrame.width}"
          height="${exportingFrame.height}"
          >
          </rect>
        </clipPath>`;
  }

  svgRoot.innerHTML = `
  ${SVG_EXPORT_TAG}
  ${metadata}
  <defs>
    <style class="style-fonts">
      @font-face {
        font-family: "Virgil";
        src: url("${assetPath}Virgil.woff2");
      }
      @font-face {
        font-family: "Cascadia";
        src: url("${assetPath}Cascadia.woff2");
      }
    </style>
    ${exportingFrameClipPath}
  </defs>
  `;

  // render background rect
  if (appState.exportBackground && viewBackgroundColor) {
    const rect = svgRoot.ownerDocument!.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", `${width}`);
    rect.setAttribute("height", `${height}`);
    rect.setAttribute("fill", viewBackgroundColor);
    svgRoot.appendChild(rect);
  }

  const rsvg = rough.svg(svgRoot);
  renderSceneToSvg(elements, rsvg, svgRoot, files || {}, {
    offsetX,
    offsetY,
    exportWithDarkMode: appState.exportWithDarkMode,
    exportingFrameId: exportingFrame?.id || null,
    renderEmbeddables: opts?.renderEmbeddables,
  });

  return svgRoot;
};

// calculate smallest area to fit the contents in
export const getCanvasSize = (
  elements: readonly NonDeletedExcalidrawElement[],
): [minX: number, minY: number, width: number, height: number] => {
  // we should decide if we are exporting the whole canvas
  // if so, we are not clipping elements in the frame
  // and therefore, we should not do anything special

  const isExportingWholeCanvas =
    Scene.getScene(elements[0])?.getNonDeletedElements()?.length ===
    elements.length;

  const onlyExportingSingleFrame = isOnlyExportingSingleFrame(elements);

  if (!isExportingWholeCanvas || onlyExportingSingleFrame) {
    const frames = elements.filter((element) => element.type === "frame");

    const exportedFrameIds = frames.reduce((acc, frame) => {
      acc[frame.id] = true;
      return acc;
    }, {} as Record<string, true>);

    // elements in a frame do not affect the canvas size if we're not exporting
    // the whole canvas
    elements = elements.filter(
      (element) => !exportedFrameIds[element.frameId ?? ""],
    );
  }

  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const width = distance(minX, maxX);
  const height = distance(minY, maxY);

  return [minX, minY, width, height];
};
