import { Recipe, InventorySlot } from '../types';
import { BlockId } from '../world/Block';
import { Inventory } from './Inventory';

export enum ItemId {
  STICK = 100,
  WOODEN_PICKAXE = 101,
  WOODEN_AXE = 102,
  WOODEN_SWORD = 103,
  BRICK_PICKAXE = 104,
  BRICK_AXE = 105,
  BRICK_SWORD = 106,
  CHICKEN_PICKAXE = 107,
  CHICKEN_AXE = 108,
  CHICKEN_SWORD = 109,
  CHICKEN_WAND = 110,
  CLUCK_SHIELD = 111,
  GOLDEN_EGG = 112
}

export class CraftingSystem {
  private static recipes: Recipe[] = [];
  
  static {
    this.registerRecipes();
  }
  
  private static registerRecipes(): void {
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [null, null, null]
      ],
      output: { itemId: ItemId.STICK, count: 4 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, BlockId.WOOD, null],
        [null, null, null]
      ],
      output: { itemId: BlockId.CRAFTING_TABLE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.WOOD, BlockId.WOOD, BlockId.WOOD],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.WOODEN_PICKAXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.WOODEN_AXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [ItemId.STICK, null, null]
      ],
      output: { itemId: ItemId.WOODEN_SWORD, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.BRICK, BlockId.BRICK, BlockId.BRICK],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.BRICK_PICKAXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.BRICK, BlockId.BRICK, null],
        [BlockId.BRICK, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.BRICK_AXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.BRICK, null, null],
        [BlockId.BRICK, null, null],
        [ItemId.STICK, null, null]
      ],
      output: { itemId: ItemId.BRICK_SWORD, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.CHICKENHEAD, BlockId.CHICKENHEAD, BlockId.CHICKENHEAD],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.CHICKEN_PICKAXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.CHICKENHEAD, BlockId.CHICKENHEAD, null],
        [BlockId.CHICKENHEAD, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.CHICKEN_AXE, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.CHICKENHEAD, null, null],
        [BlockId.CHICKENHEAD, null, null],
        [ItemId.STICK, null, null]
      ],
      output: { itemId: ItemId.CHICKEN_SWORD, count: 1 }
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.CHICKENHEAD, null, null],
        [ItemId.STICK, null, null],
        [ItemId.STICK, null, null]
      ],
      output: { itemId: ItemId.CHICKEN_WAND, count: 1 },
      predicate: (inv) => inv.getSettings?.().surprises === true
    });
    
    this.recipes.push({
      shaped: true,
      pattern: [
        [BlockId.CHICKENHEAD, BlockId.CHICKENHEAD, BlockId.CHICKENHEAD],
        [null, BlockId.BRICK, null],
        [null, ItemId.STICK, null]
      ],
      output: { itemId: ItemId.CLUCK_SHIELD, count: 1 },
      predicate: (inv) => inv.getSettings?.().surprises === true
    });
  }
  
  static findRecipe(grid: (number | null)[][]): Recipe | null {
    for (const recipe of this.recipes) {
      if (this.matchesRecipe(grid, recipe)) {
        return recipe;
      }
    }
    return null;
  }
  
  private static matchesRecipe(grid: (number | null)[][], recipe: Recipe): boolean {
    if (!recipe.shaped) {
      return this.matchesShapeless(grid, recipe);
    }
    
    for (let offsetY = 0; offsetY <= 3 - recipe.pattern.length; offsetY++) {
      for (let offsetX = 0; offsetX <= 3 - recipe.pattern[0].length; offsetX++) {
        if (this.matchesShapedAt(grid, recipe, offsetX, offsetY)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  private static matchesShapedAt(
    grid: (number | null)[][], 
    recipe: Recipe, 
    offsetX: number, 
    offsetY: number
  ): boolean {
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const recipeY = y - offsetY;
        const recipeX = x - offsetX;
        
        let expectedItem: number | null = null;
        
        if (recipeY >= 0 && recipeY < recipe.pattern.length &&
            recipeX >= 0 && recipeX < recipe.pattern[recipeY].length) {
          expectedItem = recipe.pattern[recipeY][recipeX];
        }
        
        const actualItem = grid[y][x];
        
        if (expectedItem !== actualItem) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  private static matchesShapeless(grid: (number | null)[][], recipe: Recipe): boolean {
    const requiredItems = new Map<number, number>();
    const gridItems = new Map<number, number>();
    
    for (const row of recipe.pattern) {
      for (const item of row) {
        if (item !== null) {
          requiredItems.set(item, (requiredItems.get(item) || 0) + 1);
        }
      }
    }
    
    for (const row of grid) {
      for (const item of row) {
        if (item !== null) {
          gridItems.set(item, (gridItems.get(item) || 0) + 1);
        }
      }
    }
    
    if (requiredItems.size !== gridItems.size) {
      return false;
    }
    
    for (const [item, count] of requiredItems) {
      if (gridItems.get(item) !== count) {
        return false;
      }
    }
    
    return true;
  }
  
  static craft(grid: (number | null)[][], inventory: Inventory): InventorySlot | null {
    const recipe = this.findRecipe(grid);
    
    if (!recipe) {
      return null;
    }
    
    if (recipe.predicate && !recipe.predicate(inventory)) {
      return null;
    }
    
    const hasIngredients = this.checkIngredients(grid, inventory);
    
    if (!hasIngredients) {
      return null;
    }
    
    return { ...recipe.output };
  }
  
  private static checkIngredients(grid: (number | null)[][], inventory: Inventory): boolean {
    const required = new Map<number, number>();
    
    for (const row of grid) {
      for (const item of row) {
        if (item !== null && item !== 0) {
          required.set(item, (required.get(item) || 0) + 1);
        }
      }
    }
    
    for (const [item, count] of required) {
      if (!inventory.hasItem(item, count)) {
        return false;
      }
    }
    
    return true;
  }
  
  static consumeIngredients(grid: (number | null)[][], inventory: Inventory): void {
    for (const row of grid) {
      for (const item of row) {
        if (item !== null && item !== 0) {
          inventory.removeItem(item, 1);
        }
      }
    }
  }
  
  static getAllRecipes(): Recipe[] {
    return [...this.recipes];
  }
  
  static getItemName(itemId: number): string {
    const names: Record<number, string> = {
      [ItemId.STICK]: 'Stick',
      [ItemId.WOODEN_PICKAXE]: 'Wooden Pickaxe',
      [ItemId.WOODEN_AXE]: 'Wooden Axe',
      [ItemId.WOODEN_SWORD]: 'Wooden Sword',
      [ItemId.BRICK_PICKAXE]: 'Brick Pickaxe',
      [ItemId.BRICK_AXE]: 'Brick Axe',
      [ItemId.BRICK_SWORD]: 'Brick Sword',
      [ItemId.CHICKEN_PICKAXE]: 'Chicken Pickaxe',
      [ItemId.CHICKEN_AXE]: 'Chicken Axe',
      [ItemId.CHICKEN_SWORD]: 'Chicken Sword',
      [ItemId.CHICKEN_WAND]: 'Chicken Wand',
      [ItemId.CLUCK_SHIELD]: 'Cluck Shield',
      [ItemId.GOLDEN_EGG]: 'Golden Egg'
    };
    
    return names[itemId] || 'Unknown Item';
  }
}