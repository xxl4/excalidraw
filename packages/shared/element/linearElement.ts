import { RoughGenerator } from "roughjs/bin/generator";
import { Drawable, Op } from "roughjs/bin/core";

import {
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  NonDeleted,
} from "../../excalidraw/element/types";
import { ElementShapes } from "../../excalidraw/scene/types";
import { generateElementShape } from "../scene/Shape";
import {
  Bounds,
  getCurvePathOps,
  getElementAbsoluteCoords,
  getMinMaxXYFromCurvePathOps,
} from "./bounds";
import { Point } from "../../excalidraw/types";
import {
  centerPoint,
  getBezierXY,
  getControlPointsForBezierCurve,
  mapIntervalToBezierT,
  rotate,
  rotatePoint,
} from "../math";

export const getLinearElementAbsoluteCoords = (
  element: ExcalidrawLinearElement,
  includeBoundText: boolean = false,
): [number, number, number, number, number, number] => {
  let coords: [number, number, number, number, number, number];
  let x1;
  let y1;
  let x2;
  let y2;
  if (element.points.length < 2) {
    // XXX this is just a poor estimate and not very useful
    const { minX, minY, maxX, maxY } = element.points.reduce(
      (limits, [x, y]) => {
        limits.minY = Math.min(limits.minY, y);
        limits.minX = Math.min(limits.minX, x);

        limits.maxX = Math.max(limits.maxX, x);
        limits.maxY = Math.max(limits.maxY, y);

        return limits;
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    );
    x1 = minX + element.x;
    y1 = minY + element.y;
    x2 = maxX + element.x;
    y2 = maxY + element.y;
  } else {
    const shape = generateElementShape(element, {
      isExporting: false,
      canvasBackgroundColor: "#fff",
    }) as T["type"] extends keyof ElementShapes
      ? ElementShapes[T["type"]]
      : Drawable | null;
    // first element is always the curve
    const ops = getCurvePathOps(shape[0]);

    const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
    x1 = minX + element.x;
    y1 = minY + element.y;
    x2 = maxX + element.x;
    y2 = maxY + element.y;
  }
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  coords = [x1, y1, x2, y2, cx, cy];

  if (!includeBoundText) {
    return coords;
  }
  // rewrite this so its pure
  // const boundTextElement = getBoundTextElement(element);
  // if (boundTextElement) {
  //   coords = LinearElementEditor.getMinMaxXYWithBoundText(
  //     element,
  //     [x1, y1, x2, y2],
  //     boundTextElement,
  //   );
  // }

  return coords;
};

const getPointsGlobalCoordinates = (
  element: NonDeleted<ExcalidrawLinearElement>,
): Point[] => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  return element.points.map((point) => {
    let { x, y } = element;
    [x, y] = rotate(x + point[0], y + point[1], cx, cy, element.angle);
    return [x, y] as const;
  });
};

const getPointGlobalCoordinates = (
  element: NonDeleted<ExcalidrawLinearElement>,
  point: Point,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  let { x, y } = element;
  [x, y] = rotate(x + point[0], y + point[1], cx, cy, element.angle);
  return [x, y] as const;
};

const getSegmentMidPoint = (
  element: NonDeleted<ExcalidrawLinearElement>,
  startPoint: Point,
  endPoint: Point,
  endPointIndex: number,
) => {
  let segmentMidPoint = centerPoint(startPoint, endPoint);
  if (element.points.length > 2 && element.roundness) {
    const controlPoints = getControlPointsForBezierCurve(
      element,
      element.points[endPointIndex],
    );
    if (controlPoints) {
      const t = mapIntervalToBezierT(
        element,
        element.points[endPointIndex],
        0.5,
      );

      const [tx, ty] = getBezierXY(
        controlPoints[0],
        controlPoints[1],
        controlPoints[2],
        controlPoints[3],
        t,
      );
      segmentMidPoint = getPointGlobalCoordinates(element, [tx, ty]);
    }
  }

  return segmentMidPoint;
};

const editorMidPointsCache: {
  version: number | null;
  points: (Point | null)[];
  zoom: number | null;
} = { version: null, points: [], zoom: null };

export const getLinearElementBoundTextElementPosition = (
  element: ExcalidrawLinearElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
): { x: number; y: number } => {
  const points = getPointsGlobalCoordinates(element);
  if (points.length < 2) {
    Object.assign(boundTextElement, { isDeleted: true });
  }
  let x = 0;
  let y = 0;
  if (element.points.length % 2 === 1) {
    const index = Math.floor(element.points.length / 2);
    const midPoint = getPointGlobalCoordinates(element, element.points[index]);
    x = midPoint[0] - boundTextElement.width / 2;
    y = midPoint[1] - boundTextElement.height / 2;
  } else {
    const index = element.points.length / 2 - 1;

    let midSegmentMidpoint = editorMidPointsCache.points[index];
    if (element.points.length === 2) {
      midSegmentMidpoint = centerPoint(points[0], points[1]);
    }
    if (
      !midSegmentMidpoint ||
      editorMidPointsCache.version !== element.version
    ) {
      midSegmentMidpoint = getSegmentMidPoint(
        element,
        points[index],
        points[index + 1],
        index + 1,
      );
    }
    x = midSegmentMidpoint[0] - boundTextElement.width / 2;
    y = midSegmentMidpoint[1] - boundTextElement.height / 2;
  }
  return { x, y };
};

const getBoundTextElementPosition = (
  element: ExcalidrawLinearElement,
  boundTextElement: ExcalidrawTextElementWithContainer,
): { x: number; y: number } => {
  const points = getPointsGlobalCoordinates(element);
  if (points.length < 2) {
    Object.assign(boundTextElement, { isDeleted: true });
  }
  let x = 0;
  let y = 0;
  if (element.points.length % 2 === 1) {
    const index = Math.floor(element.points.length / 2);
    const midPoint = getPointGlobalCoordinates(element, element.points[index]);
    x = midPoint[0] - boundTextElement.width / 2;
    y = midPoint[1] - boundTextElement.height / 2;
  } else {
    const index = element.points.length / 2 - 1;

    let midSegmentMidpoint = editorMidPointsCache.points[index];
    if (element.points.length === 2) {
      midSegmentMidpoint = centerPoint(points[0], points[1]);
    }
    if (
      !midSegmentMidpoint ||
      editorMidPointsCache.version !== element.version
    ) {
      midSegmentMidpoint = getSegmentMidPoint(
        element,
        points[index],
        points[index + 1],
        index + 1,
      );
    }
    x = midSegmentMidpoint[0] - boundTextElement.width / 2;
    y = midSegmentMidpoint[1] - boundTextElement.height / 2;
  }
  return { x, y };
};

const getMinMaxXYWithBoundText = (
  element: ExcalidrawLinearElement,
  elementBounds: Bounds,
  boundTextElement: ExcalidrawTextElementWithContainer,
): [number, number, number, number, number, number] => {
  let [x1, y1, x2, y2] = elementBounds;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const { x: boundTextX1, y: boundTextY1 } = getBoundTextElementPosition(
    element,
    boundTextElement,
  );
  const boundTextX2 = boundTextX1 + boundTextElement.width;
  const boundTextY2 = boundTextY1 + boundTextElement.height;

  const topLeftRotatedPoint = rotatePoint([x1, y1], [cx, cy], element.angle);
  const topRightRotatedPoint = rotatePoint([x2, y1], [cx, cy], element.angle);

  const counterRotateBoundTextTopLeft = rotatePoint(
    [boundTextX1, boundTextY1],

    [cx, cy],

    -element.angle,
  );
  const counterRotateBoundTextTopRight = rotatePoint(
    [boundTextX2, boundTextY1],

    [cx, cy],

    -element.angle,
  );
  const counterRotateBoundTextBottomLeft = rotatePoint(
    [boundTextX1, boundTextY2],

    [cx, cy],

    -element.angle,
  );
  const counterRotateBoundTextBottomRight = rotatePoint(
    [boundTextX2, boundTextY2],

    [cx, cy],

    -element.angle,
  );

  if (
    topLeftRotatedPoint[0] < topRightRotatedPoint[0] &&
    topLeftRotatedPoint[1] >= topRightRotatedPoint[1]
  ) {
    x1 = Math.min(x1, counterRotateBoundTextBottomLeft[0]);
    x2 = Math.max(
      x2,
      Math.max(
        counterRotateBoundTextTopRight[0],
        counterRotateBoundTextBottomRight[0],
      ),
    );
    y1 = Math.min(y1, counterRotateBoundTextTopLeft[1]);

    y2 = Math.max(y2, counterRotateBoundTextBottomRight[1]);
  } else if (
    topLeftRotatedPoint[0] >= topRightRotatedPoint[0] &&
    topLeftRotatedPoint[1] > topRightRotatedPoint[1]
  ) {
    x1 = Math.min(x1, counterRotateBoundTextBottomRight[0]);
    x2 = Math.max(
      x2,
      Math.max(
        counterRotateBoundTextTopLeft[0],
        counterRotateBoundTextTopRight[0],
      ),
    );
    y1 = Math.min(y1, counterRotateBoundTextBottomLeft[1]);

    y2 = Math.max(y2, counterRotateBoundTextTopRight[1]);
  } else if (topLeftRotatedPoint[0] >= topRightRotatedPoint[0]) {
    x1 = Math.min(x1, counterRotateBoundTextTopRight[0]);
    x2 = Math.max(x2, counterRotateBoundTextBottomLeft[0]);
    y1 = Math.min(y1, counterRotateBoundTextBottomRight[1]);

    y2 = Math.max(y2, counterRotateBoundTextTopLeft[1]);
  } else if (topLeftRotatedPoint[1] <= topRightRotatedPoint[1]) {
    x1 = Math.min(
      x1,
      Math.min(
        counterRotateBoundTextTopRight[0],
        counterRotateBoundTextTopLeft[0],
      ),
    );

    x2 = Math.max(x2, counterRotateBoundTextBottomRight[0]);
    y1 = Math.min(y1, counterRotateBoundTextTopRight[1]);
    y2 = Math.max(y2, counterRotateBoundTextBottomLeft[1]);
  }

  return [x1, y1, x2, y2, cx, cy];
};

export const getLinearElementRotatedBounds = (
  element: ExcalidrawLinearElement,
  cx: number,
  cy: number,
): Bounds => {
  if (element.points.length < 2) {
    const [pointX, pointY] = element.points[0];
    const [x, y] = rotate(
      element.x + pointX,
      element.y + pointY,
      cx,
      cy,
      element.angle,
    );

    let coords: Bounds = [x, y, x, y];
    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      const coordsWithBoundText = getMinMaxXYWithBoundText(
        element,
        [x, y, x, y],
        boundTextElement,
      );
      coords = [
        coordsWithBoundText[0],
        coordsWithBoundText[1],
        coordsWithBoundText[2],
        coordsWithBoundText[3],
      ];
    }
    return coords;
  }

  // first element is always the curve
  const shape = generateElementShape(element);
  const ops = getCurvePathOps(shape);
  const transformXY = (x: number, y: number) =>
    rotate(element.x + x, element.y + y, cx, cy, element.angle);
  const res = getMinMaxXYFromCurvePathOps(ops, transformXY);
  let coords: Bounds = [res[0], res[1], res[2], res[3]];
  const boundTextElement = getBoundTextElement(element);
  if (boundTextElement) {
    const coordsWithBoundText = getMinMaxXYWithBoundText(
      element,
      coords,
      boundTextElement,
    );
    coords = [
      coordsWithBoundText[0],
      coordsWithBoundText[1],
      coordsWithBoundText[2],
      coordsWithBoundText[3],
    ];
  }
  return coords;
};
