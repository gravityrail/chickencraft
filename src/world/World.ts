import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from './Chunk';
import { Vec3, ChunkCoord, WorldSettings } from '../types';
import { BlockRegistry, BlockId } from './Block';

export const WORLD_WIDTH = 1024;
export const WORLD_DEPTH = 1024;
export const WORLD_MIN_Y = -32;
export const WORLD_MAX_Y = 192;
export const SEA_LEVEL = 0;

export class World {
  private chunks: Map<string, Chunk> = new Map();
  private settings: WorldSettings;
  
  constructor(settings: WorldSettings) {
    this.settings = settings;
  }
  
  private getChunkKey(coord: ChunkCoord, yOffset: number): string {
    return `${coord.x},${yOffset},${coord.z}`;
  }
  
  private worldToChunkCoord(worldX: number, worldZ: number): ChunkCoord {
    return {
      x: Math.floor(worldX / CHUNK_WIDTH),
      z: Math.floor(worldZ / CHUNK_DEPTH)
    };
  }
  
  private worldToChunkY(worldY: number): number {
    return Math.floor((worldY - WORLD_MIN_Y) / CHUNK_HEIGHT) * CHUNK_HEIGHT + WORLD_MIN_Y;
  }
  
  private worldToLocalCoord(worldPos: Vec3): { chunk: ChunkCoord; yOffset: number; local: Vec3 } {
    const chunkCoord = this.worldToChunkCoord(worldPos.x, worldPos.z);
    const yOffset = this.worldToChunkY(worldPos.y);
    
    const localX = ((worldPos.x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = worldPos.y - yOffset;
    const localZ = ((worldPos.z % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
    
    return {
      chunk: chunkCoord,
      yOffset,
      local: { x: localX, y: localY, z: localZ }
    };
  }
  
  getChunk(coord: ChunkCoord, yOffset: number): Chunk | undefined {
    const key = this.getChunkKey(coord, yOffset);
    return this.chunks.get(key);
  }
  
  getOrCreateChunk(coord: ChunkCoord, yOffset: number): Chunk {
    const key = this.getChunkKey(coord, yOffset);
    let chunk = this.chunks.get(key);
    
    if (!chunk) {
      chunk = new Chunk(coord, yOffset);
      this.chunks.set(key, chunk);
    }
    
    return chunk;
  }
  
  getBlock(worldPos: Vec3): number {
    const { chunk, yOffset, local } = this.worldToLocalCoord(worldPos);
    const chunkObj = this.getChunk(chunk, yOffset);
    
    if (!chunkObj) {
      return BlockId.AIR;
    }
    
    return chunkObj.getBlockId(
      Math.floor(local.x),
      Math.floor(local.y),
      Math.floor(local.z)
    );
  }
  
  setBlock(worldPos: Vec3, blockId: number): void {
    const { chunk, yOffset, local } = this.worldToLocalCoord(worldPos);
    const chunkObj = this.getOrCreateChunk(chunk, yOffset);
    
    chunkObj.setBlockId(
      Math.floor(local.x),
      Math.floor(local.y),
      Math.floor(local.z),
      blockId
    );
    
    if (Math.floor(local.x) === 0) {
      const neighborChunk = this.getChunk({ x: chunk.x - 1, z: chunk.z }, yOffset);
      neighborChunk?.markDirty();
    }
    if (Math.floor(local.x) === CHUNK_WIDTH - 1) {
      const neighborChunk = this.getChunk({ x: chunk.x + 1, z: chunk.z }, yOffset);
      neighborChunk?.markDirty();
    }
    if (Math.floor(local.z) === 0) {
      const neighborChunk = this.getChunk({ x: chunk.x, z: chunk.z - 1 }, yOffset);
      neighborChunk?.markDirty();
    }
    if (Math.floor(local.z) === CHUNK_DEPTH - 1) {
      const neighborChunk = this.getChunk({ x: chunk.x, z: chunk.z + 1 }, yOffset);
      neighborChunk?.markDirty();
    }
    if (Math.floor(local.y) === 0) {
      const neighborChunk = this.getChunk(chunk, yOffset - CHUNK_HEIGHT);
      neighborChunk?.markDirty();
    }
    if (Math.floor(local.y) === CHUNK_HEIGHT - 1) {
      const neighborChunk = this.getChunk(chunk, yOffset + CHUNK_HEIGHT);
      neighborChunk?.markDirty();
    }
  }
  
  isSolid(worldPos: Vec3): boolean {
    const blockId = this.getBlock(worldPos);
    return BlockRegistry.isSolid(blockId);
  }
  
  isInBounds(worldPos: Vec3): boolean {
    return worldPos.x >= 0 && worldPos.x < WORLD_WIDTH &&
           worldPos.y >= WORLD_MIN_Y && worldPos.y <= WORLD_MAX_Y &&
           worldPos.z >= 0 && worldPos.z < WORLD_DEPTH;
  }
  
  getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }
  
  getChunksInRadius(center: Vec3, radius: number): Chunk[] {
    const chunks: Chunk[] = [];
    const centerChunk = this.worldToChunkCoord(center.x, center.z);
    const chunkRadius = Math.ceil(radius / CHUNK_WIDTH);
    
    for (let x = centerChunk.x - chunkRadius; x <= centerChunk.x + chunkRadius; x++) {
      for (let z = centerChunk.z - chunkRadius; z <= centerChunk.z + chunkRadius; z++) {
        for (let y = WORLD_MIN_Y; y < WORLD_MAX_Y; y += CHUNK_HEIGHT) {
          const chunk = this.getChunk({ x, z }, y);
          if (chunk) {
            chunks.push(chunk);
          }
        }
      }
    }
    
    return chunks;
  }
  
  getSettings(): WorldSettings {
    return this.settings;
  }
  
  clear(): void {
    this.chunks.clear();
  }
}