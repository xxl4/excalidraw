import {
  ExcalidrawElement,
  ExcalidrawElementType,
  ExcalidrawFreeDrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "../../excalidraw/element/types";
import { ElementOrToolType } from "../../excalidraw/types";

export const isArrowElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return element != null && element.type === "arrow";
};

export const assertNever = (
  value: never,
  message: string | null,
  softAssert?: boolean,
): never => {
  if (!message) {
    return value;
  }
  if (softAssert) {
    console.error(message);
    return value;
  }

  throw new Error(message);
};

export const isExcalidrawElement = (
  element: any,
): element is ExcalidrawElement => {
  const type: ExcalidrawElementType | undefined = element?.type;
  if (!type) {
    return false;
  }
  switch (type) {
    case "text":
    case "diamond":
    case "rectangle":
    case "iframe":
    case "embeddable":
    case "ellipse":
    case "arrow":
    case "freedraw":
    case "line":
    case "frame":
    case "magicframe":
    case "image":
    case "selection": {
      return true;
    }
    default: {
      assertNever(type, null);
      return false;
    }
  }
};

export const isFreeDrawElementType = (
  elementType: ExcalidrawElementType,
): boolean => {
  return elementType === "freedraw";
};

export const isFreeDrawElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawFreeDrawElement => {
  return element != null && isFreeDrawElementType(element.type);
};

export const isLinearElementType = (
  elementType: ElementOrToolType,
): boolean => {
  return (
    elementType === "arrow" || elementType === "line" // || elementType === "freedraw"
  );
};

export const isLinearElement = (
  element?: ExcalidrawElement | null,
): element is ExcalidrawLinearElement => {
  return element != null && isLinearElementType(element.type);
};

export const isTextElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElement => {
  return element != null && element.type === "text";
};

export const isBoundToContainer = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElementWithContainer => {
  return (
    element !== null &&
    "containerId" in element &&
    element.containerId !== null &&
    isTextElement(element)
  );
};
