export type Direction = "up" | "down" | "left" | "right";

export type GridPosition = {
  x: number;
  y: number;
};

export function createGridPosition(x: number, y: number): GridPosition {
  return { x, y };
}

export function samePosition(
  left: GridPosition | null | undefined,
  right: GridPosition | null | undefined
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y;
}

export function movePosition(position: GridPosition, direction: Direction): GridPosition {
  switch (direction) {
    case "up":
      return { x: position.x, y: position.y - 1 };
    case "down":
      return { x: position.x, y: position.y + 1 };
    case "left":
      return { x: position.x - 1, y: position.y };
    case "right":
      return { x: position.x + 1, y: position.y };
    default:
      return position;
  }
}
