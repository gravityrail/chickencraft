import { describe, it, expect } from 'vitest';
import { CraftingSystem, ItemId } from '../game/Crafting';
import { BlockId } from '../world/Block';
import { Inventory } from '../game/Inventory';

describe('CraftingSystem', () => {
  describe('findRecipe', () => {
    it('should find stick recipe', () => {
      const grid = [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [null, null, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.STICK);
      expect(recipe?.output.count).toBe(4);
    });
    
    it('should find crafting table recipe', () => {
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, BlockId.WOOD, null],
        [null, null, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(BlockId.CRAFTING_TABLE);
    });
    
    it('should find wooden pickaxe recipe', () => {
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, BlockId.WOOD],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.WOODEN_PICKAXE);
    });
    
    it('should find wooden axe recipe', () => {
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.WOODEN_AXE);
    });
    
    it('should find wooden sword recipe', () => {
      const grid = [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [ItemId.STICK, null, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.WOODEN_SWORD);
    });
    
    it('should find brick pickaxe recipe', () => {
      const grid = [
        [BlockId.BRICK, BlockId.BRICK, BlockId.BRICK],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.BRICK_PICKAXE);
    });
    
    it('should return null for invalid recipe', () => {
      const grid = [
        [BlockId.GRASS, BlockId.GRASS, null],
        [null, null, null],
        [null, null, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeNull();
    });
    
    it('should match recipe at any position in grid', () => {
      const grid = [
        [null, null, null],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.STICK);
    });
  });
  
  describe('craft', () => {
    it('should craft item when ingredients are available', () => {
      const inventory = new Inventory(36);
      inventory.addItem(BlockId.WOOD, 10);
      
      const grid = [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [null, null, null]
      ];
      
      const result = CraftingSystem.craft(grid, inventory);
      expect(result).toBeDefined();
      expect(result?.itemId).toBe(ItemId.STICK);
      expect(result?.count).toBe(4);
    });
    
    it('should return null when ingredients are insufficient', () => {
      const inventory = new Inventory(36);
      inventory.addItem(BlockId.WOOD, 1);
      
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, BlockId.WOOD, null],
        [null, null, null]
      ];
      
      const result = CraftingSystem.craft(grid, inventory);
      expect(result).toBeNull();
    });
  });
  
  describe('consumeIngredients', () => {
    it('should remove ingredients from inventory', () => {
      const inventory = new Inventory(36);
      inventory.addItem(BlockId.WOOD, 10);
      
      const grid = [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [null, null, null]
      ];
      
      CraftingSystem.consumeIngredients(grid, inventory);
      expect(inventory.countItem(BlockId.WOOD)).toBe(8);
    });
  });
  
  describe('getItemName', () => {
    it('should return correct item names', () => {
      expect(CraftingSystem.getItemName(ItemId.STICK)).toBe('Stick');
      expect(CraftingSystem.getItemName(ItemId.WOODEN_PICKAXE)).toBe('Wooden Pickaxe');
      expect(CraftingSystem.getItemName(ItemId.BRICK_AXE)).toBe('Brick Axe');
      expect(CraftingSystem.getItemName(ItemId.CHICKEN_SWORD)).toBe('Chicken Sword');
    });
    
    it('should return Unknown Item for invalid IDs', () => {
      expect(CraftingSystem.getItemName(999)).toBe('Unknown Item');
    });
  });
  
  describe('chicken recipes', () => {
    it('should find chicken pickaxe recipe', () => {
      const grid = [
        [BlockId.CHICKENHEAD, BlockId.CHICKENHEAD, BlockId.CHICKENHEAD],
        [null, ItemId.STICK, null],
        [null, ItemId.STICK, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.CHICKEN_PICKAXE);
    });
    
    it('should find chicken wand recipe with surprises enabled', () => {
      const grid = [
        [BlockId.CHICKENHEAD, null, null],
        [ItemId.STICK, null, null],
        [ItemId.STICK, null, null]
      ];
      
      const recipe = CraftingSystem.findRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.itemId).toBe(ItemId.CHICKEN_WAND);
    });
  });
});