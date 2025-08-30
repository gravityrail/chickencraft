import { BlockDef } from '../types';

export enum BlockId {
  AIR = 0,
  GRASS = 1,
  WOOD = 2,
  BRICK = 3,
  BEDROCK = 4,
  LAVA = 5,
  CHICKENHEAD = 6,
  CRAFTING_TABLE = 7,
}

export enum TextureId {
  GRASS_TOP = 0,
  GRASS_SIDE = 1,
  DIRT = 2,
  WOOD = 3,
  BRICK = 4,
  BEDROCK = 5,
  LAVA = 6,
  CHICKEN_FACE = 7,
  CHICKEN_SIDE = 8,
  CRAFTING_TOP = 9,
  CRAFTING_SIDE = 10,
}

export class BlockRegistry {
  private static blocks: Map<number, BlockDef> = new Map();
  
  static {
    this.registerBlocks();
  }
  
  private static registerBlocks(): void {
    const blocks: BlockDef[] = [
      {
        id: BlockId.AIR,
        name: 'Air',
        solid: false,
        opaque: false,
        hardness: 0,
        faceTiles: [0, 0, 0, 0, 0, 0]
      },
      {
        id: BlockId.GRASS,
        name: 'Grass',
        solid: true,
        opaque: true,
        hardness: 1.0,
        faceTiles: [
          TextureId.GRASS_TOP,
          TextureId.DIRT,
          TextureId.GRASS_SIDE,
          TextureId.GRASS_SIDE,
          TextureId.GRASS_SIDE,
          TextureId.GRASS_SIDE
        ]
      },
      {
        id: BlockId.WOOD,
        name: 'Wood',
        solid: true,
        opaque: true,
        hardness: 2.0,
        faceTiles: [
          TextureId.WOOD,
          TextureId.WOOD,
          TextureId.WOOD,
          TextureId.WOOD,
          TextureId.WOOD,
          TextureId.WOOD
        ]
      },
      {
        id: BlockId.BRICK,
        name: 'Brick',
        solid: true,
        opaque: true,
        hardness: 4.0,
        faceTiles: [
          TextureId.BRICK,
          TextureId.BRICK,
          TextureId.BRICK,
          TextureId.BRICK,
          TextureId.BRICK,
          TextureId.BRICK
        ]
      },
      {
        id: BlockId.BEDROCK,
        name: 'Bedrock',
        solid: true,
        opaque: true,
        hardness: Infinity,
        faceTiles: [
          TextureId.BEDROCK,
          TextureId.BEDROCK,
          TextureId.BEDROCK,
          TextureId.BEDROCK,
          TextureId.BEDROCK,
          TextureId.BEDROCK
        ]
      },
      {
        id: BlockId.LAVA,
        name: 'Lava',
        solid: false,
        opaque: true,
        hardness: Infinity,
        damage: 1,
        emits: 0.8,
        faceTiles: [
          TextureId.LAVA,
          TextureId.LAVA,
          TextureId.LAVA,
          TextureId.LAVA,
          TextureId.LAVA,
          TextureId.LAVA
        ]
      },
      {
        id: BlockId.CHICKENHEAD,
        name: 'Chickenhead',
        solid: true,
        opaque: true,
        hardness: 1.5,
        faceTiles: [
          TextureId.CHICKEN_SIDE,
          TextureId.CHICKEN_SIDE,
          TextureId.CHICKEN_SIDE,
          TextureId.CHICKEN_SIDE,
          TextureId.CHICKEN_FACE,
          TextureId.CHICKEN_SIDE
        ]
      },
      {
        id: BlockId.CRAFTING_TABLE,
        name: 'Crafting Table',
        solid: true,
        opaque: true,
        hardness: 2.5,
        faceTiles: [
          TextureId.CRAFTING_TOP,
          TextureId.WOOD,
          TextureId.CRAFTING_SIDE,
          TextureId.CRAFTING_SIDE,
          TextureId.CRAFTING_SIDE,
          TextureId.CRAFTING_SIDE
        ]
      }
    ];
    
    blocks.forEach(block => {
      this.blocks.set(block.id, block);
    });
  }
  
  static getBlock(id: number): BlockDef | undefined {
    return this.blocks.get(id);
  }
  
  static getAllBlocks(): BlockDef[] {
    return Array.from(this.blocks.values());
  }
  
  static isAir(id: number): boolean {
    return id === BlockId.AIR;
  }
  
  static isSolid(id: number): boolean {
    const block = this.getBlock(id);
    return block ? block.solid : false;
  }
  
  static isOpaque(id: number): boolean {
    const block = this.getBlock(id);
    return block ? block.opaque : false;
  }
  
  static canBreak(id: number): boolean {
    const block = this.getBlock(id);
    return block ? block.hardness !== Infinity : false;
  }
}