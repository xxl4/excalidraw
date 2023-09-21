import {
  exportToCanvas as _exportToCanvas,
  ExportToCanvasConfig,
  ExportToCanvasData,
  exportToSvg as _exportToSvg,
} from "../scene/export";
import { getNonDeletedElements } from "../element";
import { ExcalidrawElement } from "../element/types";
import { restore } from "../data/restore";
import { DEFAULT_BACKGROUND_COLOR, MIME_TYPES } from "../constants";
import { encodePngMetadata } from "../data/image";
import { serializeAsJSON } from "../data/json";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../clipboard";
import Scene from "../scene/Scene";
import { duplicateElements } from "../element/newElement";

// getContainerElement and getBoundTextElement and potentially other helpers
// depend on `Scene` which will not be available when these pure utils are
// called outside initialized Excalidraw editor instance or even if called
// from inside Excalidraw if the elements were never cached by Scene (e.g.
// for library elements).
//
// As such, before passing the elements down, we need to initialize a custom
// Scene instance and assign them to it.
//
// FIXME This is a super hacky workaround and we'll need to rewrite this soon.
const passElementsSafely = (elements: readonly ExcalidrawElement[]) => {
  const scene = new Scene();
  scene.replaceAllElements(duplicateElements(elements));
  return scene.getNonDeletedElements();
};

export { MIME_TYPES };

type ExportToBlobConfig = ExportToCanvasConfig & {
  mimeType?: string;
  quality?: number;
};

type ExportToSvgConfig = Pick<
  ExportToCanvasConfig,
  "canvasBackgroundColor" | "padding" | "theme"
> & {
  exportPadding?: number;
  renderEmbeddables?: boolean;
};

export const exportToBlob = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToBlobConfig;
}): Promise<Blob> => {
  let { mimeType = MIME_TYPES.png, quality } = config || {};

  if (mimeType === MIME_TYPES.png && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "${MIME_TYPES.png}" mimeType`);
  }

  // typo in MIME type (should be "jpeg")
  if (mimeType === "image/jpg") {
    mimeType = MIME_TYPES.jpg;
  }

  if (mimeType === MIME_TYPES.jpg && !config?.canvasBackgroundColor === false) {
    console.warn(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    config = {
      ...config,
      canvasBackgroundColor:
        data.appState?.viewBackgroundColor || DEFAULT_BACKGROUND_COLOR,
    };
  }

  const canvas = await _exportToCanvas({
    data: {
      ...data,
      elements: passElementsSafely(data.elements),
    },
    config,
  });
  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return reject(new Error("couldn't export to blob"));
        }
        if (
          blob &&
          mimeType === MIME_TYPES.png &&
          data.appState?.exportEmbedScene
        ) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              // NOTE as long as we're using the Scene hack, we need to ensure
              // we pass the original, uncloned elements when serializing
              // so that we keep ids stable
              data.elements,
              data.appState,
              data.files || {},
              "local",
            ),
          });
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

export const exportToSvg = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToSvgConfig;
}): Promise<SVGSVGElement> => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { ...data, files: data.files || {} },
    null,
    null,
  );

  const appState = { ...restoredAppState, exportPadding: config?.padding };
  const elements = getNonDeletedElements(restoredElements);
  const files = data.files || {};

  return _exportToSvg(passElementsSafely(elements), appState, files, {
    renderEmbeddables: config?.renderEmbeddables,
    // NOTE as long as we're using the Scene hack, we need to ensure
    // we pass the original, uncloned elements when serializing
    // so that we keep ids stable. Hence adding the serializeAsJSON helper
    // support into the downstream exportToSvg function.
    serializeAsJSON: () => serializeAsJSON(elements, appState, files, "local"),
  });
};

export const exportToCanvas = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToCanvasConfig;
}) => {
  return _exportToCanvas({
    data: { ...data, elements: passElementsSafely(data.elements) },
    config,
  });
};

export const exportToClipboard = async ({
  type,
  data,
  config,
}: {
  data: ExportToCanvasData;
} & (
  | { type: "png"; config?: ExportToBlobConfig }
  | { type: "svg"; config?: ExportToSvgConfig }
  | { type: "json"; config?: never }
)) => {
  if (type === "svg") {
    const svg = await exportToSvg({ data, config });
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob({ data, config }));
  } else if (type === "json") {
    await copyToClipboard(data.elements, data.files);
  } else {
    throw new Error("Invalid export type");
  }
};

export { serializeAsJSON, serializeLibraryAsJSON } from "../data/json";
export {
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  loadLibraryFromBlob,
} from "../data/blob";
export { getFreeDrawSvgPath } from "../renderer/renderElement";
export { mergeLibraryItems } from "../data/library";
