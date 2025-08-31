import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingSystem, ToolType, Material } from '../crafting/CraftingSystem';
import { BlockId } from '../world/Block';

describe('CraftingSystem', () => {
  let craftingSystem: CraftingSystem;
  
  beforeEach(() => {
    craftingSystem = new CraftingSystem();
  });
  
  describe('checkRecipe', () => {
    it('should find wooden pickaxe recipe', () => {
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, BlockId.WOOD],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.PICKAXE);
      expect(recipe?.output.material).toBe(Material.WOOD);
    });
    
    it('should find brick pickaxe recipe', () => {
      const grid = [
        [BlockId.BRICK, BlockId.BRICK, BlockId.BRICK],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.PICKAXE);
      expect(recipe?.output.material).toBe(Material.BRICK);
    });
    
    it('should find wooden axe recipe', () => {
      const grid = [
        [BlockId.WOOD, BlockId.WOOD, null],
        [BlockId.WOOD, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.AXE);
      expect(recipe?.output.material).toBe(Material.WOOD);
    });
    
    it('should find brick axe recipe', () => {
      const grid = [
        [BlockId.BRICK, BlockId.BRICK, null],
        [BlockId.BRICK, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.AXE);
      expect(recipe?.output.material).toBe(Material.BRICK);
    });
    
    it('should find wooden sword recipe', () => {
      const grid = [
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null],
        [BlockId.WOOD, null, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.SWORD);
      expect(recipe?.output.material).toBe(Material.WOOD);
    });
    
    it('should find brick sword recipe', () => {
      const grid = [
        [BlockId.BRICK, null, null],
        [BlockId.BRICK, null, null],
        [BlockId.WOOD, null, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeDefined();
      expect(recipe?.output.type).toBe('tool');
      expect(recipe?.output.toolType).toBe(ToolType.SWORD);
      expect(recipe?.output.material).toBe(Material.BRICK);
    });
    
    it('should return null for invalid recipe', () => {
      const grid = [
        [BlockId.GRASS, BlockId.GRASS, null],
        [null, null, null],
        [null, null, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeNull();
    });
    
    it('should match exact pattern only', () => {
      // Different position than expected - should not match
      const grid = [
        [null, null, null],
        [null, BlockId.WOOD, null],
        [null, BlockId.WOOD, null]
      ];
      
      const recipe = craftingSystem.checkRecipe(grid);
      expect(recipe).toBeNull();
    });
  });
  
  describe('createTool', () => {
    it('should create wooden pickaxe with correct properties', () => {
      const tool = craftingSystem.createTool(ToolType.PICKAXE, Material.WOOD);
      
      expect(tool.type).toBe(ToolType.PICKAXE);
      expect(tool.material).toBe(Material.WOOD);
      expect(tool.durability).toBe(60);
      expect(tool.maxDurability).toBe(60);
      expect(tool.multipliers.get(BlockId.BRICK)).toBe(5);
      expect(tool.multipliers.get(BlockId.WOOD)).toBe(2);
    });
    
    it('should create brick axe with correct properties', () => {
      const tool = craftingSystem.createTool(ToolType.AXE, Material.BRICK);
      
      expect(tool.type).toBe(ToolType.AXE);
      expect(tool.material).toBe(Material.BRICK);
      expect(tool.durability).toBe(180);
      expect(tool.maxDurability).toBe(180);
      expect(tool.multipliers.get(BlockId.WOOD)).toBe(5);
    });
    
    it('should create fist with default durability', () => {
      const tool = craftingSystem.createTool(ToolType.FIST);
      
      expect(tool.type).toBe(ToolType.FIST);
      expect(tool.material).toBeUndefined();
      expect(tool.durability).toBe(100);
      expect(tool.maxDurability).toBe(100);
      expect(tool.multipliers.size).toBe(0);
    });
    
    it('should create sword with correct multipliers', () => {
      const tool = craftingSystem.createTool(ToolType.SWORD, Material.WOOD);
      
      expect(tool.type).toBe(ToolType.SWORD);
      expect(tool.multipliers.get(BlockId.GRASS)).toBe(1.5);
      expect(tool.multipliers.get(BlockId.WOOD)).toBe(1.2);
    });
  });
});