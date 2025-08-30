import { createNoise2D } from 'simplex-noise';
import { World, WORLD_MIN_Y, SEA_LEVEL } from './World';
import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from './Chunk';
import { BlockId } from './Block';
import { WorldSettings } from '../types';

export class WorldGenerator {
  private world: World;
  private settings: WorldSettings;
  private heightNoise: ReturnType<typeof createNoise2D>;
  private detailNoise: ReturnType<typeof createNoise2D>;
  private treeNoise: ReturnType<typeof createNoise2D>;
  private lavaNoise: ReturnType<typeof createNoise2D>;
  
  constructor(world: World) {
    this.world = world;
    this.settings = world.getSettings();
    
    const rng = this.mulberry32(this.settings.seed);
    this.heightNoise = createNoise2D(rng);
    this.detailNoise = createNoise2D(rng);
    this.treeNoise = createNoise2D(rng);
    this.lavaNoise = createNoise2D(rng);
  }
  
  private mulberry32(seed: number): () => number {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  
  private getHeightAt(x: number, z: number): number {
    const freq1 = 0.01;
    const freq2 = 0.05;
    const freq3 = 0.1;
    
    const amplitude = 20 + this.settings.mountainous * 60;
    const roughnessScale = 0.2 + this.settings.roughness * 0.8;
    
    let height = SEA_LEVEL;
    
    switch (this.settings.biomeMix) {
      case 'Flatlands':
        height += amplitude * 0.3 * this.heightNoise(x * freq1, z * freq1);
        break;
        
      case 'Highlands':
        height += amplitude * this.heightNoise(x * freq1, z * freq1);
        height += amplitude * 0.5 * this.detailNoise(x * freq2, z * freq2);
        break;
        
      case 'Archipelago':
        const islandNoise = this.heightNoise(x * freq1 * 0.5, z * freq1 * 0.5);
        if (islandNoise > 0.3) {
          height += amplitude * 0.7 * islandNoise;
        } else {
          height = SEA_LEVEL - 10;
        }
        break;
        
      default:
        height += amplitude * this.heightNoise(x * freq1, z * freq1);
        height += amplitude * 0.3 * roughnessScale * this.detailNoise(x * freq2, z * freq2);
        height += amplitude * 0.1 * roughnessScale * this.heightNoise(x * freq3, z * freq3);
    }
    
    return Math.floor(Math.max(WORLD_MIN_Y + 3, Math.min(height, 180)));
  }
  
  generateChunk(chunk: Chunk): void {
    const chunkPos = chunk.getWorldPosition();
    const yOffset = chunk.getYOffset();
    
    for (let localX = 0; localX < CHUNK_WIDTH; localX++) {
      for (let localZ = 0; localZ < CHUNK_DEPTH; localZ++) {
        const worldX = chunkPos.x + localX;
        const worldZ = chunkPos.z + localZ;
        const surfaceHeight = this.getHeightAt(worldX, worldZ);
        
        for (let localY = 0; localY < CHUNK_HEIGHT; localY++) {
          const worldY = yOffset + localY;
          let blockId = BlockId.AIR;
          
          if (worldY <= WORLD_MIN_Y + 2) {
            blockId = BlockId.BEDROCK;
          } else if (worldY < surfaceHeight - 3) {
            blockId = BlockId.BRICK;
          } else if (worldY < surfaceHeight) {
            blockId = BlockId.BRICK;
          } else if (worldY === surfaceHeight) {
            if (surfaceHeight > SEA_LEVEL) {
              blockId = BlockId.GRASS;
            } else {
              blockId = BlockId.BRICK;
            }
          }
          
          if (this.settings.lavaPockets > 0 && worldY < -10) {
            const lavaChance = this.lavaNoise(worldX * 0.05, worldZ * 0.05);
            if (lavaChance > (1 - this.settings.lavaPockets * 0.3) && blockId === BlockId.BRICK) {
              blockId = BlockId.LAVA;
            }
          }
          
          chunk.setBlockId(localX, localY, localZ, blockId);
        }
        
        if (surfaceHeight > SEA_LEVEL && this.settings.trees > 0) {
          const treeChance = this.treeNoise(worldX * 0.1, worldZ * 0.1);
          if (treeChance > (1 - this.settings.trees * 0.1)) {
            this.placeTree(worldX, surfaceHeight + 1, worldZ);
          }
        }
      }
    }
  }
  
  private placeTree(x: number, y: number, z: number): void {
    const treeHeight = 4 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < treeHeight; i++) {
      this.world.setBlock({ x, y: y + i, z }, BlockId.WOOD);
    }
    
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) <= 3) {
            const leafY = y + treeHeight - 2 + dy;
            if (!(dx === 0 && dz === 0 && dy < 2)) {
              const current = this.world.getBlock({ x: x + dx, y: leafY, z: z + dz });
              if (current === BlockId.AIR) {
                this.world.setBlock({ x: x + dx, y: leafY, z: z + dz }, BlockId.GRASS);
              }
            }
          }
        }
      }
    }
  }
  
  generateWorld(): void {
    // Don't generate the entire world at once, just generate chunks on demand
    // The generateChunk method will be called when chunks are requested
  }
  
  generateAroundPosition(position: { x: number, z: number }, radius: number): void {
    const chunkRadius = Math.ceil(radius / CHUNK_WIDTH);
    const centerChunkX = Math.floor(position.x / CHUNK_WIDTH);
    const centerChunkZ = Math.floor(position.z / CHUNK_DEPTH);
    
    let chunksGenerated = 0;
    
    for (let cx = centerChunkX - chunkRadius; cx <= centerChunkX + chunkRadius; cx++) {
      for (let cz = centerChunkZ - chunkRadius; cz <= centerChunkZ + chunkRadius; cz++) {
        // Only generate chunks within world bounds
        if (cx >= 0 && cx < 32 && cz >= 0 && cz < 32) {
          for (let cy = 0; cy < 4; cy++) {
            const yOffset = WORLD_MIN_Y + cy * CHUNK_HEIGHT;
            const chunk = this.world.getOrCreateChunk({ x: cx, z: cz }, yOffset);
            
            // Check if chunk is empty (not generated yet)
            // A better check: see if all blocks are air
            let isEmpty = true;
            for (let i = 0; i < 10; i++) {
              if (chunk.getBlockId(i, 0, 0) !== 0) {
                isEmpty = false;
                break;
              }
            }
            
            if (isEmpty) {
              this.generateChunk(chunk);
              chunksGenerated++;
            }
          }
        }
      }
    }
    
    if (chunksGenerated > 0) {
      console.log(`Generated ${chunksGenerated} new chunks`);
    }
  }
}