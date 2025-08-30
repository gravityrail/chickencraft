export interface BlockDef {
  id: number;
  name: string;
  solid: boolean;
  opaque: boolean;
  hardness: number;
  damage?: number;
  emits?: number;
  gravity?: boolean;
  faceTiles: [number, number, number, number, number, number];
}

export type ToolType = 'fist' | 'sword' | 'axe' | 'pickaxe';
export type Material = 'wood' | 'brick' | 'chicken';

export interface ToolDef {
  type: ToolType;
  material?: Material;
  durability: number;
  multipliers: Partial<Record<number, number>>;
}

export interface Recipe {
  shaped: boolean;
  pattern: (number | null)[][];
  output: { itemId: number; count: number };
  predicate?: (inv: any) => boolean;
}

export interface WorldSettings {
  seed: number;
  mountainous: number;
  roughness: number;
  moisture: number;
  temperature: number;
  trees: number;
  lavaPockets: number;
  biomeMix: 'Balanced' | 'Flatlands' | 'Highlands' | 'Archipelago';
  surprises: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ChunkCoord {
  x: number;
  z: number;
}

export interface RaycastHit {
  blockId: number;
  position: Vec3;
  normal: Vec3;
  adjacent: Vec3;
  distance: number;
}

export type Voxel = number;

export interface InventorySlot {
  itemId: number;
  count: number;
}

export interface PlayerState {
  position: Vec3;
  rotation: Vec3;
  health: number;
  maxHealth: number;
  breath: number;
  maxBreath: number;
  inventory: InventorySlot[];
  hotbarIndex: number;
  selectedTool?: ToolDef;
}