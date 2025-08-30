import { describe, it, expect, beforeEach } from 'vitest';
import { World, WORLD_MIN_Y, WORLD_MAX_Y } from '../world/World';
import { BlockId } from '../world/Block';
import { WorldSettings } from '../types';

describe('World', () => {
  let world: World;
  let settings: WorldSettings;
  
  beforeEach(() => {
    settings = {
      seed: 12345,
      mountainous: 0.5,
      roughness: 0.5,
      moisture: 0.5,
      temperature: 0.5,
      trees: 0.3,
      lavaPockets: 0.2,
      biomeMix: 'Balanced',
      surprises: false
    };
    world = new World(settings);
  });
  
  describe('constructor', () => {
    it('should create world with given settings', () => {
      expect(world.getSettings()).toEqual(settings);
    });
  });
  
  describe('block operations', () => {
    it('should set and get blocks at world coordinates', () => {
      const pos = { x: 100, y: 50, z: 200 };
      world.setBlock(pos, BlockId.GRASS);
      expect(world.getBlock(pos)).toBe(BlockId.GRASS);
    });
    
    it('should handle negative Y coordinates', () => {
      const pos = { x: 0, y: -10, z: 0 };
      world.setBlock(pos, BlockId.BEDROCK);
      expect(world.getBlock(pos)).toBe(BlockId.BEDROCK);
    });
    
    it('should return AIR for uninitialized positions', () => {
      const pos = { x: 500, y: 100, z: 500 };
      expect(world.getBlock(pos)).toBe(BlockId.AIR);
    });
    
    it('should create chunks on demand when setting blocks', () => {
      const pos = { x: 1000, y: 0, z: 1000 };
      expect(world.getAllChunks().length).toBe(0);
      
      world.setBlock(pos, BlockId.WOOD);
      expect(world.getAllChunks().length).toBeGreaterThan(0);
      expect(world.getBlock(pos)).toBe(BlockId.WOOD);
    });
  });
  
  describe('isSolid', () => {
    it('should return true for solid blocks', () => {
      const pos = { x: 0, y: 0, z: 0 };
      world.setBlock(pos, BlockId.GRASS);
      expect(world.isSolid(pos)).toBe(true);
    });
    
    it('should return false for non-solid blocks', () => {
      const pos = { x: 0, y: 0, z: 0 };
      world.setBlock(pos, BlockId.AIR);
      expect(world.isSolid(pos)).toBe(false);
      
      world.setBlock(pos, BlockId.LAVA);
      expect(world.isSolid(pos)).toBe(false);
    });
  });
  
  describe('isInBounds', () => {
    it('should return true for valid world positions', () => {
      expect(world.isInBounds({ x: 0, y: WORLD_MIN_Y, z: 0 })).toBe(true);
      expect(world.isInBounds({ x: 512, y: 0, z: 512 })).toBe(true);
      expect(world.isInBounds({ x: 1023, y: WORLD_MAX_Y, z: 1023 })).toBe(true);
    });
    
    it('should return false for out-of-bounds positions', () => {
      expect(world.isInBounds({ x: -1, y: 0, z: 0 })).toBe(false);
      expect(world.isInBounds({ x: 0, y: WORLD_MIN_Y - 1, z: 0 })).toBe(false);
      expect(world.isInBounds({ x: 0, y: WORLD_MAX_Y + 1, z: 0 })).toBe(false);
      expect(world.isInBounds({ x: 1024, y: 0, z: 0 })).toBe(false);
      expect(world.isInBounds({ x: 0, y: 0, z: 1024 })).toBe(false);
    });
  });
  
  describe('chunk management', () => {
    it('should get or create chunks correctly', () => {
      const coord = { x: 0, z: 0 };
      const yOffset = 0;
      
      const chunk1 = world.getOrCreateChunk(coord, yOffset);
      const chunk2 = world.getOrCreateChunk(coord, yOffset);
      
      expect(chunk1).toBe(chunk2);
    });
    
    it('should track multiple chunks', () => {
      world.getOrCreateChunk({ x: 0, z: 0 }, 0);
      world.getOrCreateChunk({ x: 1, z: 0 }, 0);
      world.getOrCreateChunk({ x: 0, z: 1 }, 0);
      world.getOrCreateChunk({ x: 0, z: 0 }, 64);
      
      expect(world.getAllChunks().length).toBe(4);
    });
    
    it('should clear all chunks', () => {
      world.setBlock({ x: 0, y: 0, z: 0 }, BlockId.GRASS);
      world.setBlock({ x: 100, y: 50, z: 100 }, BlockId.WOOD);
      
      expect(world.getAllChunks().length).toBeGreaterThan(0);
      
      world.clear();
      expect(world.getAllChunks().length).toBe(0);
    });
  });
  
  describe('getChunksInRadius', () => {
    beforeEach(() => {
      for (let x = 0; x < 5; x++) {
        for (let z = 0; z < 5; z++) {
          world.getOrCreateChunk({ x, z }, 0);
        }
      }
    });
    
    it('should return chunks within radius', () => {
      const center = { x: 64, y: 0, z: 64 };
      const chunks = world.getChunksInRadius(center, 100);
      
      expect(chunks.length).toBeGreaterThan(0);
    });
    
    it('should not return chunks outside radius', () => {
      const center = { x: 0, y: 0, z: 0 };
      const chunks = world.getChunksInRadius(center, 16);
      
      chunks.forEach(chunk => {
        const pos = chunk.getWorldPosition();
        const distance = Math.sqrt(
          Math.pow(pos.x - center.x, 2) + 
          Math.pow(pos.z - center.z, 2)
        );
        expect(distance).toBeLessThanOrEqual(48);
      });
    });
  });
  
  describe('neighbor chunk dirty marking', () => {
    it('should mark neighbor chunks dirty when setting edge blocks', () => {
      const chunk1 = world.getOrCreateChunk({ x: 0, z: 0 }, 0);
      const chunk2 = world.getOrCreateChunk({ x: 1, z: 0 }, 0);
      
      chunk1.clearDirty();
      chunk2.clearDirty();
      
      // Setting a block at the edge of chunk1 should mark both chunks dirty
      world.setBlock({ x: 31, y: 0, z: 0 }, BlockId.GRASS);
      
      expect(chunk1.needsRemesh()).toBe(true);
      expect(chunk2.needsRemesh()).toBe(true);
    });
  });
});