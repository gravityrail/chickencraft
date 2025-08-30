import { describe, it, expect } from 'vitest';
import { BlockRegistry, BlockId } from '../world/Block';

describe('BlockRegistry', () => {
  describe('getBlock', () => {
    it('should return block definition for valid block ID', () => {
      const grass = BlockRegistry.getBlock(BlockId.GRASS);
      expect(grass).toBeDefined();
      expect(grass?.name).toBe('Grass');
      expect(grass?.solid).toBe(true);
      expect(grass?.opaque).toBe(true);
      expect(grass?.hardness).toBe(1.0);
    });
    
    it('should return undefined for invalid block ID', () => {
      const invalid = BlockRegistry.getBlock(999);
      expect(invalid).toBeUndefined();
    });
    
    it('should return air block with correct properties', () => {
      const air = BlockRegistry.getBlock(BlockId.AIR);
      expect(air).toBeDefined();
      expect(air?.solid).toBe(false);
      expect(air?.opaque).toBe(false);
    });
  });
  
  describe('isAir', () => {
    it('should return true for air block', () => {
      expect(BlockRegistry.isAir(BlockId.AIR)).toBe(true);
    });
    
    it('should return false for non-air blocks', () => {
      expect(BlockRegistry.isAir(BlockId.GRASS)).toBe(false);
      expect(BlockRegistry.isAir(BlockId.WOOD)).toBe(false);
    });
  });
  
  describe('isSolid', () => {
    it('should return true for solid blocks', () => {
      expect(BlockRegistry.isSolid(BlockId.GRASS)).toBe(true);
      expect(BlockRegistry.isSolid(BlockId.WOOD)).toBe(true);
      expect(BlockRegistry.isSolid(BlockId.BRICK)).toBe(true);
    });
    
    it('should return false for non-solid blocks', () => {
      expect(BlockRegistry.isSolid(BlockId.AIR)).toBe(false);
      expect(BlockRegistry.isSolid(BlockId.LAVA)).toBe(false);
    });
  });
  
  describe('isOpaque', () => {
    it('should return true for opaque blocks', () => {
      expect(BlockRegistry.isOpaque(BlockId.GRASS)).toBe(true);
      expect(BlockRegistry.isOpaque(BlockId.WOOD)).toBe(true);
      expect(BlockRegistry.isOpaque(BlockId.LAVA)).toBe(true);
    });
    
    it('should return false for transparent blocks', () => {
      expect(BlockRegistry.isOpaque(BlockId.AIR)).toBe(false);
    });
  });
  
  describe('canBreak', () => {
    it('should return true for breakable blocks', () => {
      expect(BlockRegistry.canBreak(BlockId.GRASS)).toBe(true);
      expect(BlockRegistry.canBreak(BlockId.WOOD)).toBe(true);
      expect(BlockRegistry.canBreak(BlockId.BRICK)).toBe(true);
    });
    
    it('should return false for unbreakable blocks', () => {
      expect(BlockRegistry.canBreak(BlockId.BEDROCK)).toBe(false);
      expect(BlockRegistry.canBreak(BlockId.LAVA)).toBe(false);
    });
  });
  
  describe('special block properties', () => {
    it('should have damage property for lava', () => {
      const lava = BlockRegistry.getBlock(BlockId.LAVA);
      expect(lava?.damage).toBe(1);
    });
    
    it('should have emissive property for lava', () => {
      const lava = BlockRegistry.getBlock(BlockId.LAVA);
      expect(lava?.emits).toBe(0.8);
    });
    
    it('should have infinity hardness for bedrock', () => {
      const bedrock = BlockRegistry.getBlock(BlockId.BEDROCK);
      expect(bedrock?.hardness).toBe(Infinity);
    });
  });
});