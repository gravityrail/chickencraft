import { Voxel, ChunkCoord, Vec3 } from '../types';
import { BlockId } from './Block';

export const CHUNK_WIDTH = 32;
export const CHUNK_HEIGHT = 64;
export const CHUNK_DEPTH = 32;
export const CHUNK_SIZE = CHUNK_WIDTH * CHUNK_HEIGHT * CHUNK_DEPTH;

export class Chunk {
  private voxels: Uint16Array;
  private coord: ChunkCoord;
  private yOffset: number;
  private isDirty: boolean = false;
  
  constructor(coord: ChunkCoord, yOffset: number = 0) {
    this.coord = coord;
    this.yOffset = yOffset;
    this.voxels = new Uint16Array(CHUNK_SIZE);
  }
  
  getCoord(): ChunkCoord {
    return this.coord;
  }
  
  getYOffset(): number {
    return this.yOffset;
  }
  
  private getIndex(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_WIDTH || 
        y < 0 || y >= CHUNK_HEIGHT || 
        z < 0 || z >= CHUNK_DEPTH) {
      return -1;
    }
    return x + z * CHUNK_WIDTH + y * CHUNK_WIDTH * CHUNK_DEPTH;
  }
  
  getVoxel(x: number, y: number, z: number): Voxel {
    const index = this.getIndex(x, y, z);
    if (index === -1) return BlockId.AIR;
    return this.voxels[index] & 0x3FF;
  }
  
  setVoxel(x: number, y: number, z: number, voxel: Voxel): void {
    const index = this.getIndex(x, y, z);
    if (index === -1) return;
    
    const meta = (this.voxels[index] >> 10) & 0x3F;
    this.voxels[index] = (voxel & 0x3FF) | (meta << 10);
    this.isDirty = true;
  }
  
  getBlockId(x: number, y: number, z: number): number {
    return this.getVoxel(x, y, z) & 0x3FF;
  }
  
  setBlockId(x: number, y: number, z: number, blockId: number): void {
    this.setVoxel(x, y, z, blockId);
  }
  
  getMeta(x: number, y: number, z: number): number {
    const index = this.getIndex(x, y, z);
    if (index === -1) return 0;
    return (this.voxels[index] >> 10) & 0x3F;
  }
  
  setMeta(x: number, y: number, z: number, meta: number): void {
    const index = this.getIndex(x, y, z);
    if (index === -1) return;
    
    const blockId = this.voxels[index] & 0x3FF;
    this.voxels[index] = (blockId & 0x3FF) | ((meta & 0x3F) << 10);
    this.isDirty = true;
  }
  
  fill(blockId: number): void {
    for (let i = 0; i < CHUNK_SIZE; i++) {
      this.voxels[i] = blockId & 0x3FF;
    }
    this.isDirty = true;
  }
  
  getWorldPosition(): Vec3 {
    return {
      x: this.coord.x * CHUNK_WIDTH,
      y: this.yOffset,
      z: this.coord.z * CHUNK_DEPTH
    };
  }
  
  markDirty(): void {
    this.isDirty = true;
  }
  
  clearDirty(): void {
    this.isDirty = false;
  }
  
  needsRemesh(): boolean {
    return this.isDirty;
  }
  
  serialize(): ArrayBuffer {
    const buffer = this.voxels.buffer;
    if (buffer instanceof SharedArrayBuffer) {
      const copy = new ArrayBuffer(buffer.byteLength);
      new Uint8Array(copy).set(new Uint8Array(buffer));
      return copy;
    }
    return buffer.slice(0);
  }
  
  deserialize(buffer: ArrayBuffer): void {
    this.voxels = new Uint16Array(buffer);
    this.isDirty = true;
  }
  
  getVoxelData(): Uint16Array {
    return this.voxels;
  }
}