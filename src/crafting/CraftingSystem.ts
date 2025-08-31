import { BlockId } from '../world/Block';

export enum ToolType {
  FIST = 'fist',
  SWORD = 'sword',
  AXE = 'axe',
  PICKAXE = 'pickaxe'
}

export enum Material {
  WOOD = 'wood',
  BRICK = 'brick'
}

export interface Tool {
  type: ToolType;
  material?: Material;
  durability: number;
  maxDurability: number;
  multipliers: Map<BlockId, number>;
}

export interface CraftingRecipe {
  pattern: (BlockId | null)[][];
  output: {
    type: 'tool' | 'block';
    toolType?: ToolType;
    material?: Material;
    blockId?: BlockId;
    count: number;
  };
}

export class CraftingSystem {
  private recipes: CraftingRecipe[] = [];
  
  constructor() {
    this.initializeRecipes();
  }
  
  private initializeRecipes(): void {
    // Sticks recipe (2 wood vertically = 4 sticks)
    // For now we'll treat sticks as wood blocks
    
    // Wooden Pickaxe
    this.recipes.push({
      pattern: [
        [BlockId.WOOD, BlockId.WOOD, BlockId.WOOD],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.PICKAXE,
        material: Material.WOOD,
        count: 1
      }
    });
    
    // Brick Pickaxe
    this.recipes.push({
      pattern: [
        [BlockId.BRICK, BlockId.BRICK, BlockId.BRICK],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.PICKAXE,
        material: Material.BRICK,
        count: 1
      }
    });
    
    // Wooden Axe
    this.recipes.push({
      pattern: [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.AXE,
        material: Material.WOOD,
        count: 1
      }
    });
    
    // Brick Axe
    this.recipes.push({
      pattern: [
        [BlockId.BRICK, BlockId.BRICK, null],
        [BlockId.BRICK, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.AXE,
        material: Material.BRICK,
        count: 1
      }
    });
    
    // Wooden Sword
    this.recipes.push({
      pattern: [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.SWORD,
        material: Material.WOOD,
        count: 1
      }
    });
    
    // Brick Sword
    this.recipes.push({
      pattern: [
        [BlockId.BRICK, null, null],
        [BlockId.BRICK, null, null],
        [BlockId.WOOD, null, null]
      ],
      output: {
        type: 'tool',
        toolType: ToolType.SWORD,
        material: Material.BRICK,
        count: 1
      }
    });
  }
  
  checkRecipe(grid: (BlockId | null)[][]): CraftingRecipe | null {
    // Check if grid matches any recipe
    for (const recipe of this.recipes) {
      if (this.matchesPattern(grid, recipe.pattern)) {
        return recipe;
      }
    }
    return null;
  }
  
  private matchesPattern(grid: (BlockId | null)[][], pattern: (BlockId | null)[][]): boolean {
    // Check exact match
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (grid[y][x] !== pattern[y][x]) {
          return false;
        }
      }
    }
    return true;
  }
  
  createTool(type: ToolType, material?: Material): Tool {
    let durability = 100; // Default for fist
    const multipliers = new Map<BlockId, number>();
    
    if (material === Material.WOOD) {
      durability = 60;
    } else if (material === Material.BRICK) {
      durability = 180;
    }
    
    // Set tool multipliers based on type
    switch (type) {
      case ToolType.PICKAXE:
        multipliers.set(BlockId.BRICK, 5);
        multipliers.set(BlockId.GRASS, 2);
        multipliers.set(BlockId.WOOD, 2);
        break;
      case ToolType.AXE:
        multipliers.set(BlockId.WOOD, 5);
        multipliers.set(BlockId.GRASS, 2);
        break;
      case ToolType.SWORD:
        multipliers.set(BlockId.GRASS, 1.5);
        multipliers.set(BlockId.WOOD, 1.2);
        break;
    }
    
    return {
      type,
      material,
      durability,
      maxDurability: durability,
      multipliers
    };
  }
}