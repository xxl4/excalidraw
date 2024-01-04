import { NonDeletedExcalidrawElement } from "../excalidraw/element/types";
import { BinaryFiles } from "../excalidraw/types";
import { isPromiseLike } from "../shared/utils";
import { EXPORT_DATA_TYPES, MIME_TYPES } from "./constants";
import {
  isFrameLikeElement,
  isInitializedImageElement,
} from "./element/typeChecks";

type ElementsClipboard = {
  type: typeof EXPORT_DATA_TYPES.excalidrawClipboard;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles | undefined;
};

const copyTextViaExecCommand = (text: string | null) => {
  // execCommand doesn't allow copying empty strings, so if we're
  // clearing clipboard using this API, we must copy at least an empty char
  if (!text) {
    text = " ";
  }

  const isRTL = document.documentElement.getAttribute("dir") === "rtl";

  const textarea = document.createElement("textarea");

  textarea.style.border = "0";
  textarea.style.padding = "0";
  textarea.style.margin = "0";
  textarea.style.position = "absolute";
  textarea.style[isRTL ? "right" : "left"] = "-9999px";
  const yPosition = window.pageYOffset || document.documentElement.scrollTop;
  textarea.style.top = `${yPosition}px`;
  // Prevent zooming on iOS
  textarea.style.fontSize = "12pt";

  textarea.setAttribute("readonly", "");
  textarea.value = text;

  document.body.appendChild(textarea);

  let success = false;

  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    success = document.execCommand("copy");
  } catch (error: any) {
    console.error(error);
  }

  textarea.remove();

  return success;
};

export const probablySupportsClipboardWriteText =
  "clipboard" in navigator && "writeText" in navigator.clipboard;

export const copyTextToSystemClipboard = async (
  text: string | null,
  clipboardEvent?: ClipboardEvent | null,
) => {
  // (1) first try using Async Clipboard API
  if (probablySupportsClipboardWriteText) {
    try {
      // NOTE: doesn't work on FF on non-HTTPS domains, or when document
      // not focused
      await navigator.clipboard.writeText(text || "");
      return;
    } catch (error: any) {
      console.error(error);
    }
  }

  // (2) if fails and we have access to ClipboardEvent, use plain old setData()
  try {
    if (clipboardEvent) {
      clipboardEvent.clipboardData?.setData("text/plain", text || "");
      if (clipboardEvent.clipboardData?.getData("text/plain") !== text) {
        throw new Error("Failed to setData on clipboardEvent");
      }
      return;
    }
  } catch (error: any) {
    console.error(error);
  }

  // (3) if that fails, use document.execCommand
  if (!copyTextViaExecCommand(text)) {
    throw new Error(t("errors.copyToSystemClipboardFailed"));
  }
};

export const serializeAsClipboardJSON = ({
  elements,
  files,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles | null;
}) => {
  const framesToCopy = new Set(
    elements.filter((element) => isFrameLikeElement(element)),
  );
  let foundFile = false;

  const _files = elements.reduce((acc, element) => {
    if (isInitializedImageElement(element)) {
      foundFile = true;
      if (files && files[element.fileId]) {
        acc[element.fileId] = files[element.fileId];
      }
    }
    return acc;
  }, {} as BinaryFiles);

  if (foundFile && !files) {
    console.warn(
      "copyToClipboard: attempting to file element(s) without providing associated `files` object.",
    );
  }

  // select bound text elements when copying
  const contents: ElementsClipboard = {
    type: EXPORT_DATA_TYPES.excalidrawClipboard,
    elements: elements.map((element) => {
      // Needs to be rewritten so the imports don't introduce unnecessary deps
      // if (
      //   getContainingFrame(element) &&
      //   !framesToCopy.has(getContainingFrame(element)!)
      // ) {
      //   const copiedElement = deepCopyElement(element);
      //   mutateElement(copiedElement, {
      //     frameId: null,
      //   });
      //   return copiedElement;
      // }

      return element;
    }),
    files: files ? _files : undefined,
  };

  return JSON.stringify(contents);
};

export const copyToClipboard = async (
  elements: readonly NonDeletedExcalidrawElement[],
  files: BinaryFiles | null,
  /** supply if available to make the operation more certain to succeed */
  clipboardEvent?: ClipboardEvent | null,
) => {
  await copyTextToSystemClipboard(
    serializeAsClipboardJSON({ elements, files }),
    clipboardEvent,
  );
};

export const copyBlobToClipboardAsPng = async (blob: Blob | Promise<Blob>) => {
  try {
    // in Safari so far we need to construct the ClipboardItem synchronously
    // (i.e. in the same tick) otherwise browser will complain for lack of
    // user intent. Using a Promise ClipboardItem constructor solves this.
    // https://bugs.webkit.org/show_bug.cgi?id=222262
    //
    // Note that Firefox (and potentially others) seems to support Promise
    // ClipboardItem constructor, but throws on an unrelated MIME type error.
    // So we need to await this and fallback to awaiting the blob if applicable.
    await navigator.clipboard.write([
      new window.ClipboardItem({
        [MIME_TYPES.png]: blob,
      }),
    ]);
  } catch (error: any) {
    // if we're using a Promise ClipboardItem, let's try constructing
    // with resolution value instead
    if (isPromiseLike(blob)) {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          [MIME_TYPES.png]: await blob,
        }),
      ]);
    } else {
      throw error;
    }
  }
};

