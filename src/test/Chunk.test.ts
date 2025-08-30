import { describe, it, expect, beforeEach } from 'vitest';
import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from '../world/Chunk';
import { BlockId } from '../world/Block';

describe('Chunk', () => {
  let chunk: Chunk;
  
  beforeEach(() => {
    chunk = new Chunk({ x: 0, z: 0 }, 0);
  });
  
  describe('constructor', () => {
    it('should create chunk with correct coordinates', () => {
      const coord = { x: 5, z: 10 };
      const testChunk = new Chunk(coord, 32);
      expect(testChunk.getCoord()).toEqual(coord);
      expect(testChunk.getYOffset()).toBe(32);
    });
    
    it('should initialize with air blocks', () => {
      for (let x = 0; x < CHUNK_WIDTH; x++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          for (let z = 0; z < CHUNK_DEPTH; z++) {
            expect(chunk.getBlockId(x, y, z)).toBe(BlockId.AIR);
          }
        }
      }
    });
  });
  
  describe('setBlockId and getBlockId', () => {
    it('should set and get block IDs correctly', () => {
      chunk.setBlockId(0, 0, 0, BlockId.GRASS);
      expect(chunk.getBlockId(0, 0, 0)).toBe(BlockId.GRASS);
      
      chunk.setBlockId(5, 10, 15, BlockId.WOOD);
      expect(chunk.getBlockId(5, 10, 15)).toBe(BlockId.WOOD);
    });
    
    it('should handle boundary coordinates', () => {
      chunk.setBlockId(CHUNK_WIDTH - 1, CHUNK_HEIGHT - 1, CHUNK_DEPTH - 1, BlockId.BRICK);
      expect(chunk.getBlockId(CHUNK_WIDTH - 1, CHUNK_HEIGHT - 1, CHUNK_DEPTH - 1)).toBe(BlockId.BRICK);
    });
    
    it('should return AIR for out-of-bounds coordinates', () => {
      expect(chunk.getBlockId(-1, 0, 0)).toBe(BlockId.AIR);
      expect(chunk.getBlockId(0, -1, 0)).toBe(BlockId.AIR);
      expect(chunk.getBlockId(0, 0, -1)).toBe(BlockId.AIR);
      expect(chunk.getBlockId(CHUNK_WIDTH, 0, 0)).toBe(BlockId.AIR);
      expect(chunk.getBlockId(0, CHUNK_HEIGHT, 0)).toBe(BlockId.AIR);
      expect(chunk.getBlockId(0, 0, CHUNK_DEPTH)).toBe(BlockId.AIR);
    });
  });
  
  describe('metadata', () => {
    it('should set and get metadata correctly', () => {
      chunk.setMeta(0, 0, 0, 15);
      expect(chunk.getMeta(0, 0, 0)).toBe(15);
      
      chunk.setMeta(1, 1, 1, 63);
      expect(chunk.getMeta(1, 1, 1)).toBe(63);
    });
    
    it('should preserve block ID when setting metadata', () => {
      chunk.setBlockId(0, 0, 0, BlockId.GRASS);
      chunk.setMeta(0, 0, 0, 10);
      expect(chunk.getBlockId(0, 0, 0)).toBe(BlockId.GRASS);
      expect(chunk.getMeta(0, 0, 0)).toBe(10);
    });
  });
  
  describe('dirty flag', () => {
    it('should mark chunk as dirty when modified', () => {
      expect(chunk.needsRemesh()).toBe(false);
      
      chunk.setBlockId(0, 0, 0, BlockId.GRASS);
      expect(chunk.needsRemesh()).toBe(true);
      
      chunk.clearDirty();
      expect(chunk.needsRemesh()).toBe(false);
    });
    
    it('should mark dirty when metadata is changed', () => {
      chunk.clearDirty();
      chunk.setMeta(0, 0, 0, 5);
      expect(chunk.needsRemesh()).toBe(true);
    });
  });
  
  describe('fill', () => {
    it('should fill entire chunk with specified block', () => {
      chunk.fill(BlockId.BRICK);
      
      for (let x = 0; x < CHUNK_WIDTH; x++) {
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          for (let z = 0; z < CHUNK_DEPTH; z++) {
            expect(chunk.getBlockId(x, y, z)).toBe(BlockId.BRICK);
          }
        }
      }
    });
    
    it('should mark chunk as dirty after fill', () => {
      chunk.clearDirty();
      chunk.fill(BlockId.GRASS);
      expect(chunk.needsRemesh()).toBe(true);
    });
  });
  
  describe('getWorldPosition', () => {
    it('should calculate correct world position', () => {
      const testChunk = new Chunk({ x: 2, z: 3 }, 64);
      const worldPos = testChunk.getWorldPosition();
      
      expect(worldPos.x).toBe(2 * CHUNK_WIDTH);
      expect(worldPos.y).toBe(64);
      expect(worldPos.z).toBe(3 * CHUNK_DEPTH);
    });
  });
  
  describe('serialization', () => {
    it('should serialize and deserialize chunk data', () => {
      chunk.setBlockId(0, 0, 0, BlockId.GRASS);
      chunk.setBlockId(5, 10, 15, BlockId.WOOD);
      chunk.setMeta(1, 1, 1, 7);
      
      const buffer = chunk.serialize();
      
      const newChunk = new Chunk({ x: 0, z: 0 }, 0);
      newChunk.deserialize(buffer);
      
      expect(newChunk.getBlockId(0, 0, 0)).toBe(BlockId.GRASS);
      expect(newChunk.getBlockId(5, 10, 15)).toBe(BlockId.WOOD);
      expect(newChunk.getMeta(1, 1, 1)).toBe(7);
    });
    
    it('should mark chunk as dirty after deserialization', () => {
      const buffer = chunk.serialize();
      const newChunk = new Chunk({ x: 0, z: 0 }, 0);
      newChunk.clearDirty();
      
      newChunk.deserialize(buffer);
      expect(newChunk.needsRemesh()).toBe(true);
    });
  });
});