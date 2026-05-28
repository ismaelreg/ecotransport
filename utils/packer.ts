import { CargoItem, Container, PlacedItem } from "../types";

type Point = [number, number, number];
type Rotation = {
  length: number;
  width: number;
  height: number;
};

type BoxBounds = {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
};

export type UnplacedReason = "weight" | "space";

export type UnplacedItem = CargoItem & {
  reason: UnplacedReason;
};

export type PackingResult = {
  placedItems: PlacedItem[];
  unplacedItems: UnplacedItem[];
  totalItems: number;
  unplacedCount: number;
  unplacedWeight: number;
  unplacedVolume: number;
};

const EPSILON = 0.001;

const volumeOf = (item: Pick<CargoItem, "length" | "width" | "height">) =>
  item.length * item.width * item.height;

const getBounds = (item: PlacedItem): BoxBounds => ({
  x: item.position[0] - item.width / 2,
  y: item.position[1] - item.height / 2,
  z: item.position[2] - item.length / 2,
  width: item.width,
  height: item.height,
  length: item.length,
});

const overlaps = (a: BoxBounds, b: BoxBounds) =>
  a.x < b.x + b.width - EPSILON &&
  a.x + a.width > b.x + EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  a.y + a.height > b.y + EPSILON &&
  a.z < b.z + b.length - EPSILON &&
  a.z + a.length > b.z + EPSILON;

const horizontalOverlapArea = (a: BoxBounds, b: BoxBounds) => {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const zOverlap = Math.max(0, Math.min(a.z + a.length, b.z + b.length) - Math.max(a.z, b.z));
  return xOverlap * zOverlap;
};

const intervalOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const contactArea = (candidate: BoxBounds, placed: PlacedItem[]) => {
  let area = 0;

  for (const item of placed) {
    const other = getBounds(item);
    const xOverlap = intervalOverlap(candidate.x, candidate.x + candidate.width, other.x, other.x + other.width);
    const yOverlap = intervalOverlap(candidate.y, candidate.y + candidate.height, other.y, other.y + other.height);
    const zOverlap = intervalOverlap(candidate.z, candidate.z + candidate.length, other.z, other.z + other.length);

    if (Math.abs(candidate.x - (other.x + other.width)) <= EPSILON || Math.abs(candidate.x + candidate.width - other.x) <= EPSILON) {
      area += yOverlap * zOverlap;
    }
    if (Math.abs(candidate.z - (other.z + other.length)) <= EPSILON || Math.abs(candidate.z + candidate.length - other.z) <= EPSILON) {
      area += xOverlap * yOverlap;
    }
    if (Math.abs(candidate.y - (other.y + other.height)) <= EPSILON || Math.abs(candidate.y + candidate.height - other.y) <= EPSILON) {
      area += xOverlap * zOverlap;
    }
  }

  return area;
};

const uniqueRotations = (item: CargoItem): Rotation[] => {
  const dims = [item.length, item.width, item.height];
  const permutations = item.tiltable
    ? [
        [0, 1, 2],
        [0, 2, 1],
        [1, 0, 2],
        [1, 2, 0],
        [2, 0, 1],
        [2, 1, 0],
      ]
    : [
        [0, 1, 2],
        [1, 0, 2],
      ];

  return permutations.reduce<Rotation[]>((acc, permutation) => {
    const rotation = {
      length: dims[permutation[0]],
      width: dims[permutation[1]],
      height: dims[permutation[2]],
    };

    const alreadyExists = acc.some(
      (existing) =>
        existing.length === rotation.length &&
        existing.width === rotation.width &&
        existing.height === rotation.height
    );

    return alreadyExists ? acc : [...acc, rotation];
  }, []);
};

const hasEnoughSupport = (candidate: BoxBounds, placed: PlacedItem[]) => {
  if (candidate.y <= EPSILON) return true;

  const footprint = candidate.width * candidate.length;
  let supportedArea = 0;

  for (const item of placed) {
    if (!item.stackable) continue;

    const support = getBounds(item);
    const isDirectlyBelow = Math.abs(candidate.y - (support.y + support.height)) <= EPSILON;
    if (!isDirectlyBelow) continue;

    supportedArea += horizontalOverlapArea(candidate, support);
  }

  return supportedArea / footprint >= 0.6;
};

const isInsideContainer = (candidate: BoxBounds, container: Container) =>
  candidate.x >= -EPSILON &&
  candidate.y >= -EPSILON &&
  candidate.z >= -EPSILON &&
  candidate.x + candidate.width <= container.width + EPSILON &&
  candidate.y + candidate.height <= (container.height || 450) + EPSILON &&
  candidate.z + candidate.length <= container.length + EPSILON;

const isFeasible = (candidate: BoxBounds, container: Container, placed: PlacedItem[]) =>
  isInsideContainer(candidate, container) &&
  !placed.some((item) => overlaps(candidate, getBounds(item))) &&
  hasEnoughSupport(candidate, placed);

const pointKey = ([x, y, z]: Point) => `${Math.round(x * 1000)}:${Math.round(y * 1000)}:${Math.round(z * 1000)}`;

const pruneExtremePoints = (points: Point[], container: Container, placed: PlacedItem[]) => {
  const seen = new Set<string>();
  const filtered: Point[] = [];

  for (const point of points) {
    const [x, y, z] = point;
    if (x < -EPSILON || y < -EPSILON || z < -EPSILON) continue;
    if (x > container.width + EPSILON || y > (container.height || 450) + EPSILON || z > container.length + EPSILON) continue;

    const insidePlaced = placed.some((item) => {
      const b = getBounds(item);
      return (
        x > b.x + EPSILON &&
        x < b.x + b.width - EPSILON &&
        y > b.y + EPSILON &&
        y < b.y + b.height - EPSILON &&
        z > b.z + EPSILON &&
        z < b.z + b.length - EPSILON
      );
    });
    if (insidePlaced) continue;

    const key = pointKey(point);
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(point);
  }

  return filtered.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
};

const placementScore = (
  candidate: BoxBounds,
  rotation: Rotation,
  container: Container,
  placed: PlacedItem[],
  currentWeight: number,
  itemWeight: number
) => {
  const maxX = Math.max(candidate.x + candidate.width, ...placed.map((item) => getBounds(item).x + item.width), 0);
  const maxY = Math.max(candidate.y + candidate.height, ...placed.map((item) => getBounds(item).y + item.height), 0);
  const maxZ = Math.max(candidate.z + candidate.length, ...placed.map((item) => getBounds(item).z + item.length), 0);
  const enclosingVolume = maxX * maxY * maxZ;
  const containerCenterX = container.width / 2;
  const containerCenterZ = container.length / 2;
  const newCenterX = (containerCenterX * currentWeight + (candidate.x + rotation.width / 2) * itemWeight) / (currentWeight + itemWeight);
  const newCenterZ = (containerCenterZ * currentWeight + (candidate.z + rotation.length / 2) * itemWeight) / (currentWeight + itemWeight);
  const balancePenalty = Math.abs(newCenterX - containerCenterX) + Math.abs(newCenterZ - containerCenterZ) * 0.35;
  const floorPreference = candidate.y;
  const wallContact =
    (candidate.x <= EPSILON ? 1 : 0) +
    (candidate.z <= EPSILON ? 1 : 0) +
    (candidate.x + candidate.width >= container.width - EPSILON ? 1 : 0) +
    (candidate.z + candidate.length >= container.length - EPSILON ? 1 : 0);
  const compactnessBonus = contactArea(candidate, placed) * 0.08 + wallContact * 450;

  return enclosingVolume + maxY * 250 + maxZ * 25 + balancePenalty * 10 + floorPreference * 8 - compactnessBonus;
};

const buildExtremePoints = (placed: PlacedItem[], container: Container): Point[] => {
  const points: Point[] = [[0, 0, 0]];

  for (const item of placed) {
    const b = getBounds(item);
    points.push(
      [b.x + b.width, b.y, b.z],
      [b.x, b.y + b.height, b.z],
      [b.x, b.y, b.z + b.length],
      [b.x + b.width, b.y, b.z + b.length],
      [b.x, b.y + b.height, b.z + b.length],
      [b.x + b.width, b.y + b.height, b.z]
    );
  }

  return pruneExtremePoints(points, container, placed);
};

/**
 * Extreme Point Best-Fit Decreasing para 3D bin packing.
 * El problema de cubicaje es NP-duro; esta heuristica coloca primero cajas de mayor
 * volumen/peso y evalua puntos extremos para reducir aire, altura y desbalance.
 */
export const packItemsDetailed = (
  container: Container,
  items: CargoItem[],
  loadingMode: "FIFO" | "LIFO" = "FIFO"
): PackingResult => {
  const placed: PlacedItem[] = [];
  const unplacedItems: UnplacedItem[] = [];
  const orderedGroups = loadingMode === "LIFO" ? [...items].reverse() : [...items];
  const individualItems: CargoItem[] = [];

  orderedGroups.forEach((item, groupIndex) => {
    for (let i = 0; i < item.quantity; i++) {
      individualItems.push({ ...item, id: `${item.id}-${i}`, quantity: 1 });
    }
  });

  individualItems.sort((a, b) => {
    const volumeDiff = volumeOf(b) - volumeOf(a);
    if (volumeDiff !== 0) return volumeDiff;
    const weightDiff = b.weight - a.weight;
    if (weightDiff !== 0) return weightDiff;
    return Math.max(b.length, b.width, b.height) - Math.max(a.length, a.width, a.height);
  });

  let currentWeight = 0;

  for (const item of individualItems) {
    if (currentWeight + item.weight > container.maxWeight) {
      unplacedItems.push({ ...item, reason: "weight" });
      continue;
    }

    const extremePoints = buildExtremePoints(placed, container);
    let best: { item: PlacedItem; score: number } | null = null;

    for (const point of extremePoints) {
      for (const rotation of uniqueRotations(item)) {
        const candidate: BoxBounds = {
          x: point[0],
          y: point[1],
          z: point[2],
          width: rotation.width,
          height: rotation.height,
          length: rotation.length,
        };

        if (!isFeasible(candidate, container, placed)) continue;

        const score = placementScore(candidate, rotation, container, placed, currentWeight, item.weight);
        if (!best || score < best.score) {
          best = {
            score,
            item: {
              ...item,
              width: rotation.width,
              height: rotation.height,
              length: rotation.length,
              position: [
                candidate.x + candidate.width / 2,
                candidate.y + candidate.height / 2,
                candidate.z + candidate.length / 2,
              ],
            },
          };
        }
      }
    }

    if (best) {
      placed.push(best.item);
      currentWeight += item.weight;
    } else {
      unplacedItems.push({ ...item, reason: "space" });
    }
  }

  return {
    placedItems: placed,
    unplacedItems,
    totalItems: individualItems.length,
    unplacedCount: unplacedItems.length,
    unplacedWeight: unplacedItems.reduce((acc, item) => acc + item.weight, 0),
    unplacedVolume: unplacedItems.reduce((acc, item) => acc + volumeOf(item), 0) / 1000000,
  };
};

export const packItems = (
  container: Container,
  items: CargoItem[],
  loadingMode: "FIFO" | "LIFO" = "FIFO"
): PlacedItem[] => packItemsDetailed(container, items, loadingMode).placedItems;
