import { 
  Engine, Scene, HemisphericLight, Vector3, UniversalCamera, 
  Color3, StandardMaterial, MeshBuilder, Mesh, Ray, DynamicTexture,
  Texture, MultiMaterial, SubMesh, Vector4
} from '@babylonjs/core';
import { 
  AdvancedDynamicTexture, StackPanel, Button, TextBlock, Slider, 
  Control, Rectangle, Grid, Ellipse
} from '@babylonjs/gui';
import { createNoise2D } from 'simplex-noise';
import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from './world/Chunk';
import { BlockId } from './world/Block';
import { VRSupport } from './vr/VRSupport';
import { XRGui } from './vr/XRGui';
import { CraftingSystem, Tool, ToolType, Material } from './crafting/CraftingSystem';
import { CraftingUI } from './ui/CraftingUI';

interface Chicken {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  state: 'walking' | 'pecking' | 'pausing';
  stateTimer: number;
  targetDirection: number;
}

interface Villager {
  headMesh: Mesh;
  bodyMesh: Mesh;
  noseMesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  state: 'idle' | 'walking' | 'talking';
  stateTimer: number;
  targetDirection: number;
}

class SimpleGame {
  private engine: Engine;
  private scene: Scene;
  private camera!: UniversalCamera;
  private chunks: Map<string, Chunk> = new Map();
  private chunkMeshes: Map<string, Mesh[]> = new Map();
  private velocity: Vector3 = Vector3.Zero();
  private isGrounded: boolean = false;
  private gravity: number = -20;
  private jumpVelocity: number = 8;
  private walkSpeed: number = 6;
  private runSpeed: number = 12; // Double speed when running
  private turnSpeed: number = 0.002;
  private playerHeight: number = 0.9; // Reduced from 1.8 to be closer to ground
  
  // World generation parameters
  private worldSeed: number = Date.now();
  private mountainHeight: number = 15;
  private terrainRoughness: number = 0.5;
  private terrainScale: number = 0.03;
  private worldType: string = 'default';
  private waterLevel: number = 0;
  
  // UI elements
  private advancedTexture!: AdvancedDynamicTexture;
  private crosshair!: Ellipse;
  private hotbarSlots: Rectangle[] = [];
  private selectedTool: number = 0;
  private isGuiActive: boolean = false;
  
  // Tools and inventory
  private blockInventory: Map<BlockId, number> = new Map();
  private inventoryPanel: StackPanel | null = null;
  private craftingUI: CraftingUI | null = null;
  private inventoryVisible: boolean = false;
  
  // Mining - currently instant, no progress tracking needed
  
  // VR Support
  private vrSupport?: VRSupport;
  private xrGui?: XRGui;
  
  // Crafting and tools
  private craftingSystem: CraftingSystem;
  private currentTool: Tool;
  private tools: (Tool | null)[] = new Array(9).fill(null);
  private craftingGrid: (BlockId | null)[][] = Array(3).fill(null).map(() => Array(3).fill(null));
  private isCraftingOpen: boolean = false;
  
  // Textures
  private useTextures: boolean = false; // Off by default for performance
  private grassTexture?: Texture;
  private dirtTexture?: Texture;
  private rockTexture?: Texture;
  private texturesCreated: boolean = false;
  private textureWorker?: Worker;
  private textureProgress: Map<string, number> = new Map();
  private textureProgressBar?: Rectangle;
  
  // Shared materials to prevent memory issues
  private blockMaterials: Map<string, StandardMaterial> = new Map();
  
  // Chicken-related properties
  private chickens: Chicken[] = [];
  private chickensEnabled: boolean = false;
  private chickenTexture?: Texture;
  private chickenMaterial?: StandardMaterial;
  private maxChickens: number = 10;
  
  // Villager-related properties
  private villagers: Villager[] = [];
  private villagersEnabled: boolean = false;
  private villagerFaceTexture?: Texture;
  private villagerBodyTexture?: Texture;
  private villagerSideTexture?: Texture;
  private peopleDensity: number = 0; // Default density per world
  private maxVillagers: number = 15;
  
  private getOrCreateBlockMaterial(blockId: BlockId): StandardMaterial {
    // Create a material key based on block type and texture state
    const materialKey = `${blockId}_${this.useTextures ? 'textured' : 'solid'}`;
    
    // Check if material already exists
    let material = this.blockMaterials.get(materialKey);
    if (material) {
      return material;
    }
    
    // Create new shared material
    material = new StandardMaterial(`blockMat_${materialKey}`, this.scene);
    
    if (this.useTextures && this.texturesCreated) {
      // Use textures
      switch(blockId) {
        case BlockId.GRASS:
          material.diffuseTexture = this.grassTexture || null;
          material.diffuseColor = new Color3(1, 1, 1);
          break;
        case BlockId.WOOD:
          material.diffuseTexture = this.dirtTexture || null;
          material.diffuseColor = new Color3(1, 1, 1);
          break;
        case BlockId.BRICK:
          material.diffuseTexture = this.rockTexture || null;
          material.diffuseColor = new Color3(1, 1, 1);
          break;
        default:
          material.diffuseColor = new Color3(0.8, 0.8, 0.8);
      }
    } else {
      // Use solid colors
      switch(blockId) {
        case BlockId.GRASS:
          material.diffuseColor = new Color3(0.3, 0.7, 0.2);
          break;
        case BlockId.WOOD:
          material.diffuseColor = new Color3(0.5, 0.3, 0.1);
          break;
        case BlockId.BRICK:
          material.diffuseColor = new Color3(0.5, 0.5, 0.5);
          break;
        case BlockId.LAVA:
          material.diffuseColor = new Color3(1, 0.3, 0);
          material.emissiveColor = new Color3(1, 0.5, 0);
          material.specularColor = new Color3(0, 0, 0);
          break;
        case BlockId.BEDROCK:
          material.diffuseColor = new Color3(0.2, 0.2, 0.2);
          break;
        default:
          material.diffuseColor = new Color3(0.8, 0.8, 0.8);
      }
    }
    
    // Freeze the material for better performance
    material.freeze();
    
    // Store the material for reuse
    this.blockMaterials.set(materialKey, material);
    return material;
  }
  
  // World generation toggle
  private autoGenerateChunks: boolean = false; // Off by default for performance
  
  constructor(canvas: HTMLCanvasElement) {
    console.log('Initializing game...');
    
    // Initialize crafting system
    this.craftingSystem = new CraftingSystem();
    this.currentTool = this.craftingSystem.createTool(ToolType.FIST);
    
    // Initialize inventory
    this.blockInventory.set(BlockId.GRASS, 0);
    this.blockInventory.set(BlockId.WOOD, 0);
    this.blockInventory.set(BlockId.BRICK, 0);
    
    // Create engine and scene
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    
    // Setup scene
    this.setupScene();
    
    // Create world
    this.createWorld();
    
    // Setup controls
    this.setupControls(canvas);
    
    // Setup GUI
    this.setupGUI();
    
    // Initialize VR support
    this.initializeVR();
    
    // Initialize chicken texture
    this.initializeChickenTexture();
    
    // Initialize villager textures
    this.initializeVillagerTextures();
    
    // Start game loop
    this.startGameLoop();
    
    console.log('Game initialized');
  }
  
  private loadChunksAroundPlayer(): void {
    const playerChunkX = Math.floor(this.camera.position.x / CHUNK_WIDTH);
    const playerChunkZ = Math.floor(this.camera.position.z / CHUNK_DEPTH);
    const viewDistance = 2; // Generate chunks within 2 chunk radius to ensure ground is always present
    
    for (let cx = playerChunkX - viewDistance; cx <= playerChunkX + viewDistance; cx++) {
      for (let cz = playerChunkZ - viewDistance; cz <= playerChunkZ + viewDistance; cz++) {
        const key = `${cx}_0_${cz}`;
        
        // Generate chunk if it doesn't exist
        if (!this.chunks.has(key)) {
          this.generateChunkAt(cx, cz);
        }
      }
    }
    
    // Remove chunks that are too far away
    const maxDistance = 3;
    this.chunks.forEach((_, key) => {
      const [cx, , cz] = key.split('_').map(Number);
      const distance = Math.max(
        Math.abs(cx - playerChunkX),
        Math.abs(cz - playerChunkZ)
      );
      
      if (distance > maxDistance) {
        // Remove chunk and its meshes
        const meshes = this.chunkMeshes.get(key);
        if (meshes) {
          meshes.forEach(mesh => {
            if (mesh.material) {
              mesh.material.dispose();
            }
            mesh.dispose();
          });
          this.chunkMeshes.delete(key);
        }
        this.chunks.delete(key);
      }
    });
  }
  
  private generateChunkAt(cx: number, cz: number): void {
    const chunk = new Chunk({ x: cx, z: cz }, 0);
    const noise = createNoise2D(() => this.worldSeed);
    
    // Generate terrain based on world type
    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let z = 0; z < CHUNK_DEPTH; z++) {
        const worldX = cx * CHUNK_WIDTH + x;
        const worldZ = cz * CHUNK_DEPTH + z;
        
        let height = 8; // Base height
        
        // Generate height based on world type
        switch(this.worldType) {
          case 'desert':
            // Desert: rolling sand dunes, minimal variation
            height = 5 + noise(worldX * 0.05, worldZ * 0.05) * 3;
            height += noise(worldX * 0.1, worldZ * 0.1) * 2;
            break;
            
          case 'island':
            // Island: ring of land with water in center and edges
            const distFromCenter = Math.sqrt(Math.pow(worldX - 16, 2) + Math.pow(worldZ - 16, 2));
            if (distFromCenter < 8 || distFromCenter > 20) {
              height = this.waterLevel - 2; // Below water
            } else {
              height = 6 + noise(worldX * 0.03, worldZ * 0.03) * 4;
              height += noise(worldX * 0.06, worldZ * 0.06) * 2;
            }
            break;
            
          case 'mountains':
            // Mountains: tall peaks with steep terrain
            height = 8 + noise(worldX * 0.02, worldZ * 0.02) * 20;
            height += noise(worldX * 0.04, worldZ * 0.04) * 10;
            height += noise(worldX * 0.08, worldZ * 0.08) * 5;
            break;
            
          case 'village':
            // Village: mostly flat with some gentle hills
            height = 8 + noise(worldX * 0.08, worldZ * 0.08) * 3;
            // Create flat areas for buildings
            if ((worldX % 8 < 5) && (worldZ % 8 < 5)) {
              height = 8; // Flat building areas
            }
            break;
            
          case 'lava':
            // Lava world: rough terrain with lots of lava pockets
            height = 6 + noise(worldX * 0.04, worldZ * 0.04) * 8;
            height += noise(worldX * 0.08, worldZ * 0.08) * 4;
            // Create lava lakes at surface
            if (noise(worldX * 0.02, worldZ * 0.02) < -0.3) {
              height = 3; // Low areas for lava lakes
            }
            break;
            
          default:
            // Default terrain generation
            height += noise(worldX * this.terrainScale * 0.5, worldZ * this.terrainScale * 0.5) * this.mountainHeight;
            height += noise(worldX * this.terrainScale, worldZ * this.terrainScale) * this.mountainHeight * 0.5 * this.terrainRoughness;
            height += noise(worldX * this.terrainScale * 2, worldZ * this.terrainScale * 2) * 2 * this.terrainRoughness;
        }
        
        // Ensure minimum height and convert to integer
        height = Math.max(2, Math.floor(height));
        
        // Add bedrock at bottom
        chunk.setBlockId(x, 0, z, BlockId.BEDROCK);
        
        // Fill terrain with appropriate blocks
        for (let y = 1; y < Math.min(height, CHUNK_HEIGHT - 1); y++) {
          let blockType = BlockId.BRICK;
          
          // Add lava at very deep levels (below y=3) for all worlds
          if (y <= 2 && this.worldType !== 'lava') {
            // Random lava pockets underground
            if (noise(worldX * 0.1, worldZ * 0.1 + y * 100) > 0.6) {
              blockType = BlockId.LAVA;
            } else {
              blockType = BlockId.BRICK;
            }
          }
          // Lava world special handling
          else if (this.worldType === 'lava') {
            if (y <= 3 && height <= 3) {
              // Surface lava lakes
              blockType = BlockId.LAVA;
            } else if (y < 2) {
              // Underground lava is common
              blockType = noise(worldX * 0.15, worldZ * 0.15) > 0.3 ? BlockId.LAVA : BlockId.BRICK;
            } else if (y < height - 1) {
              // Blackened stone
              blockType = BlockId.BRICK;
            } else {
              // Charred surface
              blockType = BlockId.BRICK;
            }
          }
          // Choose block type based on world type
          else if (this.worldType === 'desert') {
            // Desert uses sand-colored "wood" blocks
            blockType = BlockId.WOOD;
          } else if (this.worldType === 'island' && height <= this.waterLevel + 2) {
            // Beach sand near water
            blockType = BlockId.WOOD;
          } else if (y < height - 3) {
            blockType = BlockId.BRICK; // Stone/rock
          } else if (y < height - 1) {
            blockType = BlockId.BRICK; // Dirt layer
          } else {
            // Top layer
            if (this.worldType === 'desert') {
              blockType = BlockId.WOOD; // Sand
            } else if (this.worldType === 'mountains' && height > 20) {
              blockType = BlockId.BRICK; // Snow on peaks (using white brick)
            } else {
              blockType = BlockId.GRASS;
            }
          }
          
          chunk.setBlockId(x, y, z, blockType);
        }
      }
    }
    
    const key = `${cx}_0_${cz}`;
    this.chunks.set(key, chunk);
    this.createChunkMesh(chunk, key);
  }
  
  private async initializeVR(): Promise<void> {
    this.vrSupport = new VRSupport(this.scene, this.camera);
    await this.vrSupport.initialize();
    
    // Set up VR callbacks for mining and placing
    this.vrSupport.setMiningCallback((position: Vector3) => {
      this.mineBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z));
    });
    
    this.vrSupport.setPlacingCallback((position: Vector3) => {
      // Place selected block type based on current tool slot
      const blockType = this.selectedTool < 3 ? 
        [BlockId.GRASS, BlockId.WOOD, BlockId.BRICK][this.selectedTool] : 
        BlockId.GRASS;
      this.placeBlock(Math.floor(position.x), Math.floor(position.y), Math.floor(position.z), blockType);
    });
    
    // Add VR button to UI
    if (this.vrSupport.isVRAvailable && this.advancedTexture) {
      this.vrSupport.createVRButton(this.advancedTexture);
    }
  }
  
  private setupScene(): void {
    // Sky color
    this.scene.clearColor = new Color3(0.5, 0.7, 1).toColor4();
    
    // Lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.8;
    light.groundColor = new Color3(0.2, 0.2, 0.3);
    
    // Fog
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.7, 0.8, 0.9);
    this.scene.fogStart = 50;
    this.scene.fogEnd = 200;
    
    // Camera - start high to avoid falling through ungenerated terrain
    this.camera = new UniversalCamera('camera', new Vector3(-16, 50, -16), this.scene);
    this.camera.setTarget(new Vector3(-16, 50, -15));
    this.camera.minZ = 0.1;
    this.camera.maxZ = 500;
    this.camera.fov = Math.PI / 180 * 75;
    
    // Disable built-in camera controls - we'll handle them manually
    this.camera.inputs.clear();
    this.camera.attachControl();
  }
  
  private createWorld(): void {
    console.log(`Creating ${this.worldType} world with seed ${this.worldSeed}`);
    
    // Clear existing world
    this.clearWorld();
    
    // Update sky and fog colors based on world type
    if (this.worldType === 'lava') {
      // Red/orange sky for lava world
      this.scene.clearColor = new Color3(0.8, 0.3, 0.1).toColor4();
      this.scene.fogColor = new Color3(0.9, 0.4, 0.2);
      const light = this.scene.getLightByName('light') as HemisphericLight;
      if (light) {
        light.groundColor = new Color3(0.4, 0.1, 0.1);
        light.diffuse = new Color3(1, 0.6, 0.4);
      }
    } else if (this.worldType === 'desert') {
      // Sandy yellow sky for desert
      this.scene.clearColor = new Color3(0.9, 0.8, 0.6).toColor4();
      this.scene.fogColor = new Color3(0.9, 0.85, 0.7);
    } else {
      // Default blue sky
      this.scene.clearColor = new Color3(0.5, 0.7, 1).toColor4();
      this.scene.fogColor = new Color3(0.7, 0.8, 0.9);
      const light = this.scene.getLightByName('light') as HemisphericLight;
      if (light) {
        light.groundColor = new Color3(0.2, 0.2, 0.3);
        light.diffuse = new Color3(1, 1, 1);
      }
    }
    
    // Create noise function for terrain
    const noise = createNoise2D(() => this.worldSeed);
    
    // Generate initial chunks around spawn point for immediate visibility
    // Start with 2x2 chunks centered around player spawn
    const spawnChunkX = -1; // Spawn in chunk -1 (which contains x=-32 to -1)
    const spawnChunkZ = -1;
    
    for (let cx = spawnChunkX; cx <= spawnChunkX + 1; cx++) {
      for (let cz = spawnChunkZ; cz <= spawnChunkZ + 1; cz++) {
        const chunk = new Chunk({ x: cx, z: cz }, 0);
        
        // Generate terrain based on world type
        for (let x = 0; x < CHUNK_WIDTH; x++) {
          for (let z = 0; z < CHUNK_DEPTH; z++) {
            const worldX = cx * CHUNK_WIDTH + x;
            const worldZ = cz * CHUNK_DEPTH + z;
            
            let height = 8; // Base height
            
            // Generate height based on world type
            switch(this.worldType) {
              case 'desert':
                // Desert: rolling sand dunes, minimal variation
                height = 5 + noise(worldX * 0.05, worldZ * 0.05) * 3;
                height += noise(worldX * 0.1, worldZ * 0.1) * 2;
                break;
                
              case 'island':
                // Island: land mass with gradual beaches (centered at spawn)
                const distFromCenter = Math.sqrt(Math.pow(worldX + 16, 2) + Math.pow(worldZ + 16, 2));
                
                if (distFromCenter > 28) {
                  // Deep ocean
                  height = this.waterLevel - 4;
                } else if (distFromCenter > 22) {
                  // Shallow water with gradual beach
                  const beachFactor = (28 - distFromCenter) / 6;
                  height = this.waterLevel - 3 + beachFactor * 4;
                  height += noise(worldX * 0.1, worldZ * 0.1) * 0.3;
                } else if (distFromCenter > 18) {
                  // Beach zone - gentle slope from water to land
                  const beachHeight = this.waterLevel + (22 - distFromCenter) * 0.5;
                  height = beachHeight + noise(worldX * 0.08, worldZ * 0.08) * 0.5;
                } else if (distFromCenter < 5) {
                  // Central lagoon
                  height = this.waterLevel - 1;
                } else {
                  // Main island terrain
                  height = 6 + noise(worldX * 0.04, worldZ * 0.04) * 3;
                  height += noise(worldX * 0.08, worldZ * 0.08) * 2;
                  // Rocky outcrops
                  const outcrop = noise(worldX * 0.2, worldZ * 0.2);
                  if (outcrop > 0.7) {
                    height += (outcrop - 0.7) * 15;
                  }
                }
                break;
                
              case 'mountains':
                // Mountains: tall peaks with steep terrain
                height = 8 + noise(worldX * 0.02, worldZ * 0.02) * 20;
                height += noise(worldX * 0.04, worldZ * 0.04) * 10;
                height += noise(worldX * 0.08, worldZ * 0.08) * 5;
                break;
                
              case 'village':
                // Village: mostly flat with some gentle hills
                height = 8 + noise(worldX * 0.08, worldZ * 0.08) * 3;
                // Create flat areas for buildings
                if ((worldX % 8 < 5) && (worldZ % 8 < 5)) {
                  height = 8; // Flat building areas
                }
                break;
                
              default:
                // Default terrain generation
                height += noise(worldX * this.terrainScale * 0.5, worldZ * this.terrainScale * 0.5) * this.mountainHeight;
                height += noise(worldX * this.terrainScale, worldZ * this.terrainScale) * this.mountainHeight * 0.5 * this.terrainRoughness;
                height += noise(worldX * this.terrainScale * 2, worldZ * this.terrainScale * 2) * 2 * this.terrainRoughness;
            }
            
            // Ensure minimum height and convert to integer
            height = Math.max(2, Math.floor(height));
            
            // Fill terrain with appropriate blocks
            for (let y = 0; y < Math.min(height, CHUNK_HEIGHT - 1); y++) {
              let blockType = BlockId.BRICK;
              
              // Choose block type based on world type
              if (this.worldType === 'desert') {
                // Desert uses sand-colored "wood" blocks
                blockType = BlockId.WOOD;
              } else if (this.worldType === 'island' && height <= this.waterLevel + 2) {
                // Beach sand near water
                blockType = BlockId.WOOD;
              } else if (y < height - 3) {
                blockType = BlockId.BRICK; // Stone/rock
              } else if (y < height - 1) {
                blockType = BlockId.BRICK; // Dirt layer
              } else {
                // Top layer
                if (this.worldType === 'desert') {
                  blockType = BlockId.WOOD; // Sand
                } else if (this.worldType === 'mountains' && height > 20) {
                  blockType = BlockId.BRICK; // Snow on peaks (using white brick)
                } else {
                  blockType = BlockId.GRASS;
                }
              }
              
              chunk.setBlockId(x, y, z, blockType);
            }
            
            // Add water blocks for island world
            if (this.worldType === 'island' && height < this.waterLevel) {
              for (let y = height; y <= this.waterLevel; y++) {
                // We'll use a water plane instead of blocks for performance
              }
            }
          }
        }
        
        const key = `${cx}_0_${cz}`;
        this.chunks.set(key, chunk);
        this.createChunkMesh(chunk, key);
        console.log(`Generated chunk at ${cx}, ${cz}`);
      }
    }
    
    console.log(`Total chunks generated: ${this.chunks.size}`);
    
    // Add world-specific features
    if (this.worldType === 'desert') {
      // Desert: fewer trees, cacti-like structures
      this.addDesertFeatures();
    } else if (this.worldType === 'island') {
      // Island: palm trees near beaches
      this.addIslandFeatures();
    } else if (this.worldType === 'mountains') {
      // Mountains: pine trees at lower elevations
      this.addMountainFeatures();
    } else if (this.worldType === 'village') {
      // Village: add simple house structures
      this.addVillageFeatures();
    } else {
      // Default: normal trees
      this.addTrees();
    }
    
    // Position player above terrain at spawn point - center of generated chunks
    const spawnX = -16; // Center of chunk at -1, 0 (which spans -32 to 0)
    const spawnZ = -16; // Center of chunk at -1, 0
    
    // Get the actual terrain height at spawn point
    let groundY = 10; // Default fallback
    
    // Sample multiple points to find solid ground
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const testY = this.getHeightAt(spawnX + dx, spawnZ + dz);
        if (testY > this.waterLevel) {
          groundY = Math.max(groundY, testY);
        }
      }
    }
    
    const spawnY = groundY + this.playerHeight + 1; // Place player on ground
    this.camera.position = new Vector3(spawnX, spawnY, spawnZ);
    console.log(`Player spawned at: ${spawnX}, ${spawnY}, ${spawnZ} (ground at ${groundY})`);
    
    // Add water plane (visible for island, hidden for others)
    const water = MeshBuilder.CreateGround('water', { width: 200, height: 200 }, this.scene);
    water.position.y = this.waterLevel;
    const waterMat = new StandardMaterial('waterMat', this.scene);
    waterMat.diffuseColor = new Color3(0.1, 0.3, 0.6);
    waterMat.alpha = this.worldType === 'island' ? 0.7 : 0;
    waterMat.backFaceCulling = false;
    water.material = waterMat;
    
    // Make water visible only for island world
    water.isVisible = this.worldType === 'island';
    
    console.log('World created');
  }
  
  private createBlockTexturesAsync(): void {
    // Show progress bar
    this.showTextureProgress();
    
    // Create web worker for texture generation
    this.textureWorker = new Worker(
      new URL('./workers/textureWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    const texturesToGenerate = ['grass', 'dirt', 'rock'];
    let texturesCompleted = 0;
    
    this.textureWorker.onmessage = async (e) => {
      const { type, blob, progress, error } = e.data;
      
      if (error) {
        console.error('Texture generation error:', error);
        this.hideTextureProgress();
        return;
      }
      
      if (progress && progress < 100) {
        // Update progress
        this.textureProgress.set(type, progress);
        this.updateTextureProgress();
      } else if (blob) {
        // Texture completed
        const url = URL.createObjectURL(blob);
        const texture = new Texture(url, this.scene);
        
        switch(type) {
          case 'grass':
            this.grassTexture = texture;
            break;
          case 'dirt':
            this.dirtTexture = texture;
            break;
          case 'rock':
            this.rockTexture = texture;
            break;
        }
        
        this.textureProgress.set(type, 100);
        texturesCompleted++;
        
        if (texturesCompleted === texturesToGenerate.length) {
          // All textures complete
          this.texturesCreated = true;
          this.hideTextureProgress();
          
          // Apply textures to all chunks
          this.chunks.forEach((chunk, key) => {
            this.createChunkMesh(chunk, key);
          });
          
          // Clean up worker
          this.textureWorker?.terminate();
          this.textureWorker = undefined;
        } else {
          // Generate next texture
          const nextType = texturesToGenerate[texturesCompleted];
          this.textureWorker?.postMessage({ type: nextType, size: 64 });
        }
        
        this.updateTextureProgress();
      }
    };
    
    // Start generating first texture
    this.textureWorker.postMessage({ type: texturesToGenerate[0], size: 64 });
  }
  
  private showTextureProgress(): void {
    // Create progress bar container
    const container = new Rectangle();
    container.width = "300px";
    container.height = "60px";
    container.thickness = 2;
    container.color = "white";
    container.background = "rgba(0, 0, 0, 0.8)";
    container.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    container.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.advancedTexture.addControl(container);
    
    const label = new TextBlock();
    label.text = "Generating Textures...";
    label.color = "white";
    label.fontSize = 14;
    label.top = "-15px";
    container.addControl(label);
    
    const progressBar = new Rectangle();
    progressBar.width = "280px";
    progressBar.height = "20px";
    progressBar.thickness = 1;
    progressBar.color = "white";
    progressBar.background = "#4CAF50";
    progressBar.top = "15px";
    progressBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    progressBar.left = "10px";
    container.addControl(progressBar);
    
    this.textureProgressBar = container;
  }
  
  private updateTextureProgress(): void {
    if (!this.textureProgressBar) return;
    
    // Calculate overall progress
    let totalProgress = 0;
    const textures = ['grass', 'dirt', 'rock'];
    for (const type of textures) {
      totalProgress += this.textureProgress.get(type) || 0;
    }
    const overallProgress = totalProgress / (textures.length * 100);
    
    // Update progress bar width
    const progressBar = this.textureProgressBar.children[1] as Rectangle;
    if (progressBar) {
      progressBar.width = `${280 * overallProgress}px`;
    }
  }
  
  private hideTextureProgress(): void {
    if (this.textureProgressBar) {
      this.advancedTexture.removeControl(this.textureProgressBar);
      this.textureProgressBar = undefined;
    }
    this.textureProgress.clear();
  }
  
  private createLeafTexture(): Texture {
    const size = 64; // Reduced for consistency
    const texture = new DynamicTexture("leafTexture", size, this.scene);
    const context = texture.getContext();
    
    // Clear with transparency
    context.clearRect(0, 0, size, size);
    
    // Create much denser leaf pattern for better visibility
    for (let i = 0; i < 150; i++) { // Increased from 30 to 150 for higher density
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const greenVariation = Math.floor(150 + Math.random() * 50);
      context.fillStyle = `rgba(${Math.floor(80 + Math.random() * 40)}, ${greenVariation}, ${Math.floor(50 + Math.random() * 30)}, ${0.8 + Math.random() * 0.2})`;
      context.fillRect(x, y, 2 + Math.floor(Math.random() * 2), 2 + Math.floor(Math.random() * 2));
    }
    
    texture.update();
    texture.hasAlpha = true;
    return texture;
  }
  
  private addDesertFeatures(): void {
    // Add cacti with arms instead of trees
    for (let i = 0; i < 8; i++) {
      // Keep features within generated chunks (-32 to 31)
      const x = -32 + Math.random() * 64;
      const z = -32 + Math.random() * 64;
      const y = this.getHeightAt(x, z);
      
      // Only place cacti on solid ground
      if (y > this.waterLevel + 2 && y < 15) {
        // Main cactus trunk
        const trunk = MeshBuilder.CreateBox(`cactus_${i}`, { width: 0.5, height: 3, depth: 0.5 }, this.scene);
        trunk.position = new Vector3(x, y + 1.5, z);
        const cactusMat = new StandardMaterial(`cactusMat_${i}`, this.scene);
        cactusMat.diffuseColor = new Color3(0.2, 0.5, 0.2);
        trunk.material = cactusMat;
        
        // Add 1-2 cactus arms randomly
        const numArms = 1 + Math.floor(Math.random() * 2);
        for (let j = 0; j < numArms; j++) {
          // Horizontal arm segment
          const armSide = j === 0 ? 1 : -1; // Alternate sides
          const armHeight = y + 1.5 + Math.random() * 0.8;
          const armLength = 0.4 + Math.random() * 0.3;
          
          const armH = MeshBuilder.CreateBox(`cactusArmH_${i}_${j}`, { 
            width: armLength, 
            height: 0.4, 
            depth: 0.4 
          }, this.scene);
          armH.position = new Vector3(
            x + (armSide * (0.25 + armLength/2)), 
            armHeight, 
            z
          );
          armH.material = cactusMat;
          
          // Vertical arm segment
          const armVHeight = 0.8 + Math.random() * 0.5;
          const armV = MeshBuilder.CreateBox(`cactusArmV_${i}_${j}`, { 
            width: 0.4, 
            height: armVHeight, 
            depth: 0.4 
          }, this.scene);
          armV.position = new Vector3(
            x + (armSide * (0.25 + armLength)), 
            armHeight + armVHeight/2, 
            z
          );
          armV.material = cactusMat;
        }
      }
    }
  }
  
  private addIslandFeatures(): void {
    // Add palm trees near beaches within generated chunks
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const radius = 8 + Math.random() * 6;
      const x = -16 + Math.cos(angle) * radius;
      const z = -16 + Math.sin(angle) * radius;
      
      // Skip if outside generated chunks
      if (x < -32 || x > 31 || z < -32 || z > 31) continue;
      
      const y = this.getHeightAt(x, z);
      
      // Only place trees on solid ground above water - ensure proper ground placement
      if (y > this.waterLevel + 1 && y < this.waterLevel + 10 && y > 1) {
        // Palm tree trunk (slightly curved)
        const trunk = MeshBuilder.CreateCylinder(`palm_${i}`, { 
          height: 6, 
          diameterBottom: 0.5, 
          diameterTop: 0.3 
        }, this.scene);
        trunk.position = new Vector3(x, y + 3, z);
        trunk.rotation.z = Math.random() * 0.1 - 0.05; // Slight lean
        const trunkMat = new StandardMaterial(`palmMat_${i}`, this.scene);
        trunkMat.diffuseColor = new Color3(0.5, 0.3, 0.1);
        trunk.material = trunkMat;
        
        // Simplified palm fronds - 5-6 fronds connecting at the top
        const leafMat = new StandardMaterial(`palmLeafMat_${i}`, this.scene);
        leafMat.diffuseColor = new Color3(0.1, 0.5, 0.1);
        leafMat.backFaceCulling = false;
        
        const numFronds = 5 + Math.floor(Math.random() * 2); // 5-6 fronds
        const trunkTopY = y + 6; // Top of trunk
        
        // Create properly connected palm fronds
        for (let j = 0; j < numFronds; j++) {
          const frondAngle = (j / numFronds) * Math.PI * 2;
          
          // Create a single continuous frond using connected segments
          const totalLength = 2.5; // Total frond length
          const numSegments = 4;
          
          let prevEndX = x; // Start from trunk center
          let prevEndZ = z;
          let prevEndY = trunkTopY; // Start from trunk top
          
          for (let segment = 0; segment < numSegments; segment++) {
            const segmentLength = totalLength / numSegments;
            const segmentWidth = 0.6 - segment * 0.12; // Taper width
            
            // Calculate the end position of this segment
            const segmentDistance = (segment + 1) * segmentLength;
            const droop = segment * 0.5; // Increasing droop per segment
            
            const endX = x + Math.cos(frondAngle) * segmentDistance;
            const endZ = z + Math.sin(frondAngle) * segmentDistance;
            const endY = trunkTopY - droop;
            
            // Create segment mesh
            const frond = MeshBuilder.CreateBox(`palmFrond_${i}_${j}_${segment}`, {
              width: segmentWidth,
              height: 0.05,
              depth: segmentLength * 1.1 // Slight overlap to connect segments
            }, this.scene);
            
            // Position at midpoint between previous end and current end
            frond.position = new Vector3(
              (prevEndX + endX) / 2,
              (prevEndY + endY) / 2,
              (prevEndZ + endZ) / 2
            );
            
            // Calculate rotation to align with segment direction
            const dx = endX - prevEndX;
            const dy = endY - prevEndY;
            const dz = endZ - prevEndZ;
            
            frond.rotation.y = Math.atan2(dx, dz);
            frond.rotation.x = Math.atan2(-dy, Math.sqrt(dx * dx + dz * dz));
            frond.rotation.z = Math.sin(segment * 0.5) * 0.1; // Slight twist
            
            frond.material = leafMat;
            
            // Update previous end position for next segment
            prevEndX = endX;
            prevEndZ = endZ;
            prevEndY = endY;
          }
        }
      }
    }
  }
  
  private addMountainFeatures(): void {
    // Add pine trees at lower elevations
    for (let i = 0; i < 12; i++) {
      // Keep features within generated chunks
      const x = -32 + Math.random() * 64;
      const z = -32 + Math.random() * 64;
      const y = this.getHeightAt(x, z);
      
      // Only place pine trees on solid ground at mid elevations
      if (y > this.waterLevel + 3 && y < 18) {
        // Pine tree trunk
        const trunk = MeshBuilder.CreateBox(`pine_${i}`, { width: 0.4, height: 7, depth: 0.4 }, this.scene);
        trunk.position = new Vector3(x, y + 3.5, z);
        const trunkMat = new StandardMaterial(`pineMat_${i}`, this.scene);
        trunkMat.diffuseColor = new Color3(0.3, 0.2, 0.1);
        trunk.material = trunkMat;
        
        // Conical leaves
        const leaves = MeshBuilder.CreateCylinder(`pineLeaves_${i}`, { 
          height: 5, 
          diameterBottom: 4, 
          diameterTop: 0.5,
          tessellation: 8
        }, this.scene);
        leaves.position = new Vector3(x, y + 7, z);
        const leafMat = new StandardMaterial(`pineLeafMat_${i}`, this.scene);
        leafMat.diffuseColor = new Color3(0.1, 0.4, 0.1);
        leaves.material = leafMat;
      }
    }
  }
  
  private addVillageFeatures(): void {
    // Add block-based houses you can enter
    for (let i = 0; i < 3; i++) {
      // Find a suitable flat location
      const hx = Math.floor(-20 + i * 12);
      const hz = Math.floor(-20 + Math.random() * 20);
      const baseY = Math.floor(this.getHeightAt(hx, hz));
      
      // Skip if location is invalid
      if (baseY <= this.waterLevel || baseY > 15) continue;
      
      // Build an 8x8x8 house from blocks
      this.buildHouse(hx, baseY, hz);
    }
    
    // Add a few trees around village
    this.addTrees();
  }
  
  private buildHouse(x: number, y: number, z: number): void {
    // Get the chunk at this position
    const getChunkForPosition = (worldX: number, worldZ: number) => {
      const chunkX = Math.floor(worldX / CHUNK_WIDTH);
      const chunkZ = Math.floor(worldZ / CHUNK_DEPTH);
      const key = `${chunkX}_0_${chunkZ}`;
      return this.chunks.get(key);
    };
    
    // Set a block at world coordinates
    const setBlockAt = (worldX: number, worldY: number, worldZ: number, blockId: BlockId) => {
      const chunk = getChunkForPosition(worldX, worldZ);
      if (!chunk || worldY < 0 || worldY >= CHUNK_HEIGHT) return;
      
      const localX = ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
      const localZ = ((worldZ % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
      chunk.setBlockId(localX, worldY, localZ, blockId);
    };
    
    // Clear space for house (remove any existing blocks)
    for (let dx = 0; dx < 8; dx++) {
      for (let dy = 0; dy < 8; dy++) {
        for (let dz = 0; dz < 8; dz++) {
          setBlockAt(x + dx, y + dy, z + dz, BlockId.AIR);
        }
      }
    }
    
    // Build stone walls (BRICK blocks)
    for (let dx = 0; dx < 8; dx++) {
      for (let dy = 0; dy < 5; dy++) { // Walls are 5 blocks high
        for (let dz = 0; dz < 8; dz++) {
          // Only place blocks on the perimeter
          if (dx === 0 || dx === 7 || dz === 0 || dz === 7) {
            // Skip door opening (2 blocks wide, 3 blocks high on front)
            if (dz === 0 && dx >= 3 && dx <= 4 && dy < 3) {
              continue; // Door gap
            }
            
            // Skip window openings (2x2 on sides)
            if ((dx === 0 || dx === 7) && 
                dz >= 2 && dz <= 3 && 
                dy >= 2 && dy <= 3) {
              continue; // Window gaps
            }
            
            setBlockAt(x + dx, y + dy, z + dz, BlockId.BRICK);
          }
        }
      }
    }
    
    // Build pyramid-shaped thatched roof (WOOD blocks as straw)
    for (let roofLevel = 0; roofLevel < 4; roofLevel++) {
      const roofY = y + 5 + roofLevel;
      const inset = roofLevel;
      
      for (let dx = inset; dx < 8 - inset; dx++) {
        for (let dz = inset; dz < 8 - inset; dz++) {
          // Only place blocks on the edges of this level
          if (dx === inset || dx === 7 - inset || 
              dz === inset || dz === 7 - inset) {
            setBlockAt(x + dx, roofY, z + dz, BlockId.WOOD); // Using WOOD as straw
          }
        }
      }
    }
    
    // Add chimney (2x2 stone blocks)
    for (let cy = 0; cy < 7; cy++) {
      setBlockAt(x + 6, y + cy, z + 6, BlockId.BRICK);
      setBlockAt(x + 6, y + cy, z + 7, BlockId.BRICK);
      setBlockAt(x + 7, y + cy, z + 6, BlockId.BRICK);
      setBlockAt(x + 7, y + cy, z + 7, BlockId.BRICK);
    }
    
    // Add wooden floor inside (optional)
    for (let dx = 1; dx < 7; dx++) {
      for (let dz = 1; dz < 7; dz++) {
        setBlockAt(x + dx, y, z + dz, BlockId.WOOD);
      }
    }
    
    // Regenerate chunk meshes for affected chunks
    const chunksToUpdate = new Set<string>();
    for (let dx = 0; dx < 8; dx++) {
      for (let dz = 0; dz < 8; dz++) {
        const chunkX = Math.floor((x + dx) / CHUNK_WIDTH);
        const chunkZ = Math.floor((z + dz) / CHUNK_DEPTH);
        chunksToUpdate.add(`${chunkX}_0_${chunkZ}`);
      }
    }
    
    chunksToUpdate.forEach(key => {
      const chunk = this.chunks.get(key);
      if (chunk) {
        this.createChunkMesh(chunk, key);
      }
    });
  }
  
  private addTrees(): void {
    const leafTexture = this.createLeafTexture();
    const leafMaterial = new StandardMaterial("leafMat", this.scene);
    leafMaterial.diffuseTexture = leafTexture;
    leafMaterial.opacityTexture = leafTexture;
    leafMaterial.backFaceCulling = false;
    leafMaterial.useAlphaFromDiffuseTexture = true;
    
    // Add trees at random positions within generated chunks
    for (let i = 0; i < 20; i++) {
      const x = -30 + Math.random() * 60;
      const z = -30 + Math.random() * 60;
      const y = this.getHeightAt(x, z);
      
      // Only place trees on solid ground, well above water level - check actual height
      if (y > this.waterLevel + 2 && y < 25 && y > 2) {
        // Tree trunk
        const trunk = MeshBuilder.CreateBox(`trunk_${i}`, { width: 0.5, height: 5, depth: 0.5 }, this.scene);
        trunk.position = new Vector3(x, y + 2.5, z);
        const trunkMat = new StandardMaterial(`trunkMat_${i}`, this.scene);
        trunkMat.diffuseColor = new Color3(0.4, 0.2, 0.1);
        trunk.material = trunkMat;
        
        // Leaves - 3 intersecting circular discs to form a sphere
        const leafSize = 3;
        for (let j = 0; j < 3; j++) {
          const leaves = MeshBuilder.CreateDisc(`leaves_${i}_${j}`, { radius: leafSize / 2 }, this.scene);
          leaves.position = new Vector3(x, y + 5, z);
          leaves.material = leafMaterial;
          leaves.billboardMode = Mesh.BILLBOARDMODE_NONE;
          
          // Rotate discs to intersect at different angles around Y axis
          if (j === 0) {
            // First disc - vertical facing forward/back
            leaves.rotation.z = Math.PI / 2;
          }
          if (j === 1) {
            // Second disc - vertical rotated 60 degrees around Y
            leaves.rotation.z = Math.PI / 2;
            leaves.rotation.y = Math.PI / 3;
          }
          if (j === 2) {
            // Third disc - vertical rotated 120 degrees around Y
            leaves.rotation.z = Math.PI / 2;
            leaves.rotation.y = 2 * Math.PI / 3;
          }
        }
      }
    }
  }
  
  private isPositionInGeneratedChunk(x: number, z: number): boolean {
    const chunkX = Math.floor(x / CHUNK_WIDTH);
    const chunkZ = Math.floor(z / CHUNK_DEPTH);
    const key = `${chunkX}_0_${chunkZ}`;
    return this.chunks.has(key);
  }
  
  private getGeneratedChunkBounds(): { minX: number, maxX: number, minZ: number, maxZ: number } {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    this.chunks.forEach((_, key) => {
      const [cx, , cz] = key.split('_').map(Number);
      const chunkMinX = cx * CHUNK_WIDTH;
      const chunkMaxX = (cx + 1) * CHUNK_WIDTH;
      const chunkMinZ = cz * CHUNK_DEPTH;
      const chunkMaxZ = (cz + 1) * CHUNK_DEPTH;
      
      minX = Math.min(minX, chunkMinX);
      maxX = Math.max(maxX, chunkMaxX);
      minZ = Math.min(minZ, chunkMinZ);
      maxZ = Math.max(maxZ, chunkMaxZ);
    });
    
    return { minX, maxX, minZ, maxZ };
  }
  
  private getHeightAt(worldX: number, worldZ: number): number {
    // Sample height from the generated terrain
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    
    // Check if the chunk exists for this position
    const chunkX = Math.floor(x / CHUNK_WIDTH);
    const chunkZ = Math.floor(z / CHUNK_DEPTH);
    const chunkKey = `${chunkX}_0_${chunkZ}`;
    
    if (!this.chunks.has(chunkKey)) {
      // Chunk doesn't exist yet, estimate height based on world type
      const noise = createNoise2D(() => this.worldSeed);
      let estimatedHeight = 8;
      
      switch(this.worldType) {
        case 'island':
          // Use same center as terrain generation (-16, -16)
          const distFromCenter = Math.sqrt(Math.pow(x + 16, 2) + Math.pow(z + 16, 2));
          if (distFromCenter > 22) {
            return this.waterLevel - 2; // In water
          } else if (distFromCenter < 5) {
            return this.waterLevel - 1; // Lagoon
          }
          estimatedHeight = 6 + noise(x * 0.04, z * 0.04) * 3;
          break;
        case 'desert':
          estimatedHeight = 5 + noise(x * 0.05, z * 0.05) * 3;
          break;
        case 'mountains':
          estimatedHeight = 8 + noise(x * 0.02, z * 0.02) * 15;
          break;
        default:
          estimatedHeight = 8 + noise(x * this.terrainScale, z * this.terrainScale) * 8;
      }
      
      return Math.floor(estimatedHeight);
    }
    
    // Chunk exists, sample from it
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.getBlockAt(x, y, z) !== BlockId.AIR) {
        return y + 1;
      }
    }
    
    // No blocks found in chunk, return water level or default
    return this.waterLevel > 0 ? this.waterLevel - 1 : 8;
  }
  
  private clearWorld(): void {
    console.log('Clearing world...');
    
    // Dispose all existing chunk meshes
    this.chunkMeshes.forEach((meshes) => {
      meshes.forEach(mesh => mesh.dispose());
    });
    this.chunkMeshes.clear();
    this.chunks.clear();
    
    // Clear and dispose all shared materials (if they exist)
    if (this.blockMaterials) {
      this.blockMaterials.forEach(material => {
        material.dispose();
      });
      this.blockMaterials.clear();
    }
    
    // Remove ALL meshes except camera-related and UI elements
    // Keep a list of meshes to dispose (can't modify while iterating)
    const meshesToDispose: Mesh[] = [];
    
    this.scene.meshes.forEach(mesh => {
      // Keep only essential meshes
      if (mesh.name !== '__root__' && 
          !mesh.name.includes('camera') && 
          !mesh.name.includes('crosshair') &&
          !mesh.name.includes('skybox')) {
        meshesToDispose.push(mesh as Mesh);
      }
    });
    
    // Now dispose all marked meshes
    meshesToDispose.forEach(mesh => {
      // Also dispose any materials attached to the mesh
      if (mesh.material) {
        // Don't dispose shared block materials - they're handled above
        if (!mesh.material.name.startsWith('blockMat_')) {
          mesh.material.dispose();
        }
      }
      mesh.dispose();
    });
    
    console.log(`Cleared ${meshesToDispose.length} meshes`);
  }
  
  private createChunkMesh(chunk: Chunk, key: string): void {
    // Dispose old meshes for this chunk
    const oldMeshes = this.chunkMeshes.get(key);
    if (oldMeshes) {
      oldMeshes.forEach(mesh => {
        // Don't dispose shared materials!
        mesh.dispose();
      });
    }
    
    const meshes: Mesh[] = [];
    
    // Simple rendering - one box per block (not optimized yet)
    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_DEPTH; z++) {
          const blockId = chunk.getBlockId(x, y, z);
          
          if (blockId !== BlockId.AIR) {
            // Only create box if exposed to air
            let isExposed = false;
            
            // Check all 6 faces
            if (x === 0 || chunk.getBlockId(x - 1, y, z) === BlockId.AIR) isExposed = true;
            if (x === CHUNK_WIDTH - 1 || chunk.getBlockId(x + 1, y, z) === BlockId.AIR) isExposed = true;
            if (y === 0 || chunk.getBlockId(x, y - 1, z) === BlockId.AIR) isExposed = true;
            if (y === CHUNK_HEIGHT - 1 || chunk.getBlockId(x, y + 1, z) === BlockId.AIR) isExposed = true;
            if (z === 0 || chunk.getBlockId(x, y, z - 1) === BlockId.AIR) isExposed = true;
            if (z === CHUNK_DEPTH - 1 || chunk.getBlockId(x, y, z + 1) === BlockId.AIR) isExposed = true;
            
            if (isExposed) {
              // Parse chunk coordinates from key
              const [cx, , cz] = key.split('_').map(Number);
              const worldX = cx * CHUNK_WIDTH + x;
              const worldZ = cz * CHUNK_DEPTH + z;
              
              const box = MeshBuilder.CreateBox(`block_${worldX}_${y}_${worldZ}`, { size: 1 }, this.scene);
              box.position = new Vector3(worldX + 0.5, y + 0.5, worldZ + 0.5);
              
              // Use shared material instead of creating new ones
              box.material = this.getOrCreateBlockMaterial(blockId);
              
              meshes.push(box);
            }
          }
        }
      }
    }
    
    this.chunkMeshes.set(key, meshes);
  }
  
  private setupGUI(): void {
    // Create fullscreen UI
    this.advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    // Add top instruction bar
    const instructionText = new TextBlock();
    instructionText.text = "WASD: Move | Shift: Run | Space: Jump | Click/X: Mine | I: Inventory | K: Crafting | T: Textures | G: Gen World | VR";
    instructionText.color = "white";
    instructionText.fontSize = 14;
    instructionText.height = "25px";
    instructionText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    instructionText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    instructionText.top = "10px";
    this.advancedTexture.addControl(instructionText);
    
    // Create main panel - increased width to fit content
    const panel = new StackPanel();
    panel.width = "350px";
    panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    panel.top = "20px";
    panel.left = "-20px";
    panel.paddingTop = "20px";
    panel.paddingBottom = "20px";
    panel.paddingLeft = "20px";
    panel.paddingRight = "20px";
    panel.background = "rgba(0, 0, 0, 0.7)";
    this.advancedTexture.addControl(panel);
    
    // Track when GUI is being used
    panel.onPointerEnterObservable.add(() => {
      this.isGuiActive = true;
    });
    panel.onPointerOutObservable.add(() => {
      this.isGuiActive = false;
    });
    
    // Title
    const title = new TextBlock();
    title.text = "World Settings";
    title.color = "white";
    title.fontSize = 20;
    title.height = "30px";
    title.paddingBottom = "10px";
    panel.addControl(title);
    
    // World presets
    const presetsLabel = new TextBlock();
    presetsLabel.text = "World Presets:";
    presetsLabel.color = "white";
    presetsLabel.fontSize = 14;
    presetsLabel.height = "25px";
    presetsLabel.paddingTop = "10px";
    panel.addControl(presetsLabel);
    
    const presets = [
      { name: "Desert", mountain: 5, rough: 0.2, scale: 0.08, type: 'desert', water: -10 },
      { name: "Island", mountain: 8, rough: 0.4, scale: 0.04, type: 'island', water: 3 },
      { name: "Mountains", mountain: 25, rough: 0.8, scale: 0.02, type: 'mountains', water: 0 },
      { name: "Village", mountain: 8, rough: 0.3, scale: 0.06, type: 'village', water: 0 },
      { name: "Lava", mountain: 10, rough: 0.6, scale: 0.05, type: 'lava', water: -10 }
    ];
    
    const presetButtons = new StackPanel();
    presetButtons.isVertical = false;
    presetButtons.height = "35px";
    presetButtons.spacing = 5;
    panel.addControl(presetButtons);
    
    presets.forEach(preset => {
      const btn = Button.CreateSimpleButton(preset.name, preset.name);
      btn.width = "75px";
      btn.height = "30px";
      btn.color = "white";
      btn.background = "#2196F3";
      btn.fontSize = 12;
      btn.onPointerUpObservable.add(() => {
        this.mountainHeight = preset.mountain;
        this.terrainRoughness = preset.rough;
        this.terrainScale = preset.scale;
        this.worldType = preset.type;
        this.waterLevel = preset.water;
        this.worldSeed = Date.now();
        
        // Set people density based on world type
        if (preset.type === 'village') {
          this.peopleDensity = 8; // Higher density for village world
        } else {
          this.peopleDensity = 0; // No villagers in other worlds by default
        }
        
        this.createWorld();
        // Update slider values
        mountainSlider.value = preset.mountain;
        roughnessSlider.value = preset.rough;
        scaleSlider.value = preset.scale;
        mountainLabel.text = `Mountain Height: ${Math.round(preset.mountain)}`;
        roughnessLabel.text = `Roughness: ${(preset.rough * 100).toFixed(0)}%`;
        scaleLabel.text = `Terrain Scale: ${(preset.scale * 100).toFixed(1)}`;
      });
      presetButtons.addControl(btn);
    });
    
    // Mountain Height slider
    const mountainLabel = new TextBlock();
    mountainLabel.text = `Mountain Height: ${this.mountainHeight}`;
    mountainLabel.color = "white";
    mountainLabel.fontSize = 14;
    mountainLabel.height = "25px";
    panel.addControl(mountainLabel);
    
    const mountainSlider = new Slider();
    mountainSlider.minimum = 5;
    mountainSlider.maximum = 30;
    mountainSlider.value = this.mountainHeight;
    mountainSlider.height = "20px";
    mountainSlider.width = "200px";
    mountainSlider.color = "#00FF00";
    mountainSlider.background = "gray";
    mountainSlider.onValueChangedObservable.add((value) => {
      this.mountainHeight = value;
      mountainLabel.text = `Mountain Height: ${Math.round(value)}`;
    });
    panel.addControl(mountainSlider);
    
    // Terrain Roughness slider
    const roughnessLabel = new TextBlock();
    roughnessLabel.text = `Roughness: ${(this.terrainRoughness * 100).toFixed(0)}%`;
    roughnessLabel.color = "white";
    roughnessLabel.fontSize = 14;
    roughnessLabel.height = "25px";
    roughnessLabel.paddingTop = "10px";
    panel.addControl(roughnessLabel);
    
    const roughnessSlider = new Slider();
    roughnessSlider.minimum = 0;
    roughnessSlider.maximum = 1;
    roughnessSlider.value = this.terrainRoughness;
    roughnessSlider.height = "20px";
    roughnessSlider.width = "200px";
    roughnessSlider.color = "#00FF00";
    roughnessSlider.background = "gray";
    roughnessSlider.onValueChangedObservable.add((value) => {
      this.terrainRoughness = value;
      roughnessLabel.text = `Roughness: ${(value * 100).toFixed(0)}%`;
    });
    panel.addControl(roughnessSlider);
    
    // Terrain Scale slider
    const scaleLabel = new TextBlock();
    scaleLabel.text = `Terrain Scale: ${(this.terrainScale * 100).toFixed(1)}`;
    scaleLabel.color = "white";
    scaleLabel.fontSize = 14;
    scaleLabel.height = "25px";
    scaleLabel.paddingTop = "10px";
    panel.addControl(scaleLabel);
    
    const scaleSlider = new Slider();
    scaleSlider.minimum = 0.01;
    scaleSlider.maximum = 0.1;
    scaleSlider.value = this.terrainScale;
    scaleSlider.height = "20px";
    scaleSlider.width = "200px";
    scaleSlider.color = "#00FF00";
    scaleSlider.background = "gray";
    scaleSlider.onValueChangedObservable.add((value) => {
      this.terrainScale = value;
      scaleLabel.text = `Terrain Scale: ${(value * 100).toFixed(1)}`;
    });
    panel.addControl(scaleSlider);
    
    // Regenerate button
    const regenButton = Button.CreateSimpleButton("regen", "Regenerate World");
    regenButton.width = "200px";
    regenButton.height = "40px";
    regenButton.color = "white";
    regenButton.background = "#4CAF50";
    regenButton.cornerRadius = 5;
    regenButton.thickness = 0;
    regenButton.paddingTop = "20px";
    regenButton.fontSize = 16;
    regenButton.onPointerUpObservable.add(() => {
      this.worldSeed = Date.now();
      this.createWorld();
    });
    panel.addControl(regenButton);
    
    // Add crosshair
    this.createCrosshair();
    
    // Add hotbar
    this.createHotbar();
    
    // Create inventory panel
    this.createInventoryPanel();
    
    // Create crafting UI
    this.craftingUI = new CraftingUI(this.scene, this.advancedTexture);
  }
  
  private createInventoryPanel(): void {
    this.inventoryPanel = new StackPanel();
    this.inventoryPanel.width = "300px";
    this.inventoryPanel.height = "400px";
    this.inventoryPanel.background = "rgba(0, 0, 0, 0.8)";
    this.inventoryPanel.isVisible = false;
    this.inventoryPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.inventoryPanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.inventoryPanel.paddingTop = "20px";
    this.inventoryPanel.paddingBottom = "20px";
    
    // Title
    const title = new TextBlock();
    title.text = "Inventory";
    title.color = "white";
    title.fontSize = 24;
    title.height = "40px";
    this.inventoryPanel.addControl(title);
    
    // Close button
    const closeBtn = Button.CreateSimpleButton("closeBtn", "X");
    closeBtn.width = "30px";
    closeBtn.height = "30px";
    closeBtn.color = "white";
    closeBtn.background = "red";
    closeBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    closeBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    closeBtn.top = "-360px";
    closeBtn.left = "-120px";
    closeBtn.onPointerClickObservable.add(() => {
      this.toggleInventory();
    });
    this.inventoryPanel.addControl(closeBtn);
    
    this.advancedTexture.addControl(this.inventoryPanel);
    this.updateInventoryDisplay();
  }
  
  private updateInventoryDisplay(): void {
    if (!this.inventoryPanel) return;
    
    // Clear existing items (keep title and close button)
    while (this.inventoryPanel.children.length > 2) {
      this.inventoryPanel.removeControl(this.inventoryPanel.children[2]);
    }
    
    // Add inventory items
    const blockNames = new Map([
      [BlockId.GRASS, "Grass Blocks"],
      [BlockId.WOOD, "Wood Blocks"],
      [BlockId.BRICK, "Stone Blocks"]
    ]);
    
    blockNames.forEach((name, id) => {
      const count = this.blockInventory.get(id) || 0;
      const itemText = new TextBlock();
      itemText.text = `${name}: ${count}`;
      itemText.color = "white";
      itemText.fontSize = 18;
      itemText.height = "30px";
      itemText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.inventoryPanel!.addControl(itemText);
    });
  }
  
  private toggleInventory(): void {
    this.inventoryVisible = !this.inventoryVisible;
    if (this.inventoryPanel) {
      this.inventoryPanel.isVisible = this.inventoryVisible;
      this.updateInventoryDisplay();
    }
  }
  
  private toggleTextures(): void {
    this.useTextures = !this.useTextures;
    console.log(`Textures ${this.useTextures ? 'enabled' : 'disabled'}`);
    
    // Create textures on-demand if needed
    if (this.useTextures && !this.texturesCreated) {
      console.log('Creating textures asynchronously...');
      this.createBlockTexturesAsync();
    }
    
    // Rebuild all chunk meshes with new texture settings (if textures are ready or disabled)
    if (!this.useTextures || this.texturesCreated) {
      this.chunks.forEach((chunk, key) => {
        this.createChunkMesh(chunk, key);
      });
    }
  }
  
  private createCrosshair(): void {
    // Create crosshair in center of screen
    this.crosshair = new Ellipse();
    this.crosshair.width = "20px";
    this.crosshair.height = "20px";
    this.crosshair.color = "white";
    this.crosshair.thickness = 2;
    this.crosshair.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.crosshair.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    this.advancedTexture.addControl(this.crosshair);
    
    // Add center dot
    const dot = new Ellipse();
    dot.width = "4px";
    dot.height = "4px";
    dot.color = "white";
    dot.thickness = 0;
    dot.background = "white";
    this.crosshair.addControl(dot);
  }
  
  private createHotbar(): void {
    // Create hotbar container
    const hotbarContainer = new Rectangle();
    hotbarContainer.width = "500px";
    hotbarContainer.height = "70px";
    hotbarContainer.thickness = 0;
    hotbarContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    hotbarContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    hotbarContainer.top = "-20px";
    this.advancedTexture.addControl(hotbarContainer);
    
    const hotbarGrid = new Grid();
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true);
    hotbarGrid.addColumnDefinition(60, true); // Add 9th column for inventory button
    hotbarGrid.addRowDefinition(60, true);
    hotbarContainer.addControl(hotbarGrid);
    
    const toolIcons = ['✋', '⛏️', '🪓', '⚒️', '🧱', '🌳', '🟫', ''];
    
    for (let i = 0; i < 8; i++) {
      // Create slot background
      const slot = new Rectangle();
      slot.width = "50px";
      slot.height = "50px";
      slot.thickness = 2;
      slot.color = "white";
      slot.background = i === this.selectedTool ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.5)";
      hotbarGrid.addControl(slot, 0, i);
      this.hotbarSlots.push(slot);
      
      // Add tool icon
      const icon = new TextBlock();
      icon.text = toolIcons[i];
      icon.fontSize = 24;
      icon.color = "white";
      slot.addControl(icon);
      
      // Add number key label
      const keyLabel = new TextBlock();
      keyLabel.text = String(i + 1);
      keyLabel.fontSize = 12;
      keyLabel.color = "yellow";
      keyLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      keyLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      keyLabel.left = "-5px";
      keyLabel.top = "2px";
      slot.addControl(keyLabel);
    }
    
    // Add inventory button (9th slot)
    const invButton = Button.CreateSimpleButton("invBtn", "");
    invButton.width = "50px";
    invButton.height = "50px";
    invButton.thickness = 2;
    invButton.color = "white";
    invButton.background = "rgba(0, 0, 100, 0.5)";
    invButton.onPointerClickObservable.add(() => {
      this.toggleInventory();
    });
    hotbarGrid.addControl(invButton, 0, 8);
    
    // Add inventory icon
    const invIcon = new TextBlock();
    invIcon.text = "I";
    invIcon.fontSize = 24;
    invIcon.color = "white";
    invButton.addControl(invIcon);
  }
  
  private selectTool(index: number): void {
    if (index >= 0 && index < this.hotbarSlots.length) {
      // Update visual selection
      this.hotbarSlots.forEach((slot, i) => {
        slot.background = i === index ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.5)";
      });
      this.selectedTool = index;
    }
  }
  
  private setupControls(canvas: HTMLCanvasElement): void {
    const keys = new Set<string>();
    
    // Keyboard input
    window.addEventListener('keydown', (e) => {
      keys.add(e.code);
      
      // Jump
      if (e.code === 'Space' && this.isGrounded) {
        this.velocity.y = this.jumpVelocity;
        this.isGrounded = false;
      }
      
      // Tool selection (1-8 keys)
      if (e.code >= 'Digit1' && e.code <= 'Digit8') {
        const toolIndex = parseInt(e.code.replace('Digit', '')) - 1;
        this.selectTool(toolIndex);
      }
      
      // Mining with X key
      if (e.code === 'KeyX') {
        this.startMining();
      }
      
      // Toggle inventory with I key
      if (e.code === 'KeyI') {
        this.toggleInventory();
      }
      
      // Toggle textures with T key
      if (e.code === 'KeyT') {
        this.toggleTextures();
      }
      
      // Toggle crafting UI with K key
      if (e.code === 'KeyK') {
        if (this.craftingUI) {
          this.craftingUI.toggle();
          this.isGuiActive = this.craftingUI.getIsVisible();
        }
      }
      
      // Toggle chickens with C key
      if (e.code === 'KeyC') {
        this.toggleChickens();
      }
      
      // Toggle villagers with V key
      if (e.code === 'KeyV') {
        this.toggleVillagers();
      }
      
      // Toggle automatic world generation with G key
      if (e.code === 'KeyG') {
        this.autoGenerateChunks = !this.autoGenerateChunks;
        console.log(`Auto chunk generation ${this.autoGenerateChunks ? 'enabled' : 'disabled'}`);
        
        // Show notification to user
        const notification = new TextBlock();
        notification.text = `World Generation: ${this.autoGenerateChunks ? 'ON' : 'OFF'}`;
        notification.color = this.autoGenerateChunks ? '#4CAF50' : '#FF5252';
        notification.fontSize = 20;
        notification.fontWeight = 'bold';
        notification.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        notification.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        notification.top = '100px';
        this.advancedTexture.addControl(notification);
        
        // Remove notification after 2 seconds
        setTimeout(() => {
          this.advancedTexture.removeControl(notification);
        }, 2000);
        
        // If enabling, immediately check for chunks to generate
        if (this.autoGenerateChunks) {
          this.loadChunksAroundPlayer();
        }
      }
    });
    
    window.addEventListener('keyup', (e) => {
      keys.delete(e.code);
    });
    
    // Mouse look
    let isPointerLocked = false;
    canvas.addEventListener('click', () => {
      // Don't capture mouse if clicking on GUI or inventory is open
      if (!this.isGuiActive && !this.inventoryVisible) {
        canvas.requestPointerLock();
      }
    });
    
    // Mining/breaking blocks
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && isPointerLocked) {
        // Left click - mine block
        this.startMining();
      }
    });
    
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.stopMining();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === canvas;
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isPointerLocked) return;
      
      // Rotate camera based on mouse movement
      this.camera.rotation.y += e.movementX * this.turnSpeed;
      this.camera.rotation.x += e.movementY * this.turnSpeed;
      
      // Clamp vertical rotation
      this.camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation.x));
    });
    
    // Update movement each frame
    this.scene.registerBeforeRender(() => {
      const forward = this.camera.getForwardRay().direction;
      forward.y = 0;
      forward.normalize();
      
      const right = Vector3.Cross(forward, Vector3.Up());
      
      // Movement
      let moveX = 0;
      let moveZ = 0;
      
      // WASD movement
      if (keys.has('KeyW')) {
        moveX += forward.x;
        moveZ += forward.z;
      }
      if (keys.has('KeyS')) {
        moveX -= forward.x;
        moveZ -= forward.z;
      }
      if (keys.has('KeyA')) {
        moveX += right.x;  // Fixed: was negative
        moveZ += right.z;  // Fixed: was negative
      }
      if (keys.has('KeyD')) {
        moveX -= right.x;  // Fixed: was positive
        moveZ -= right.z;  // Fixed: was positive
      }
      
      // Arrow keys - forward/backward movement and turning
      if (keys.has('ArrowUp')) {
        moveX += forward.x;
        moveZ += forward.z;
      }
      if (keys.has('ArrowDown')) {
        moveX -= forward.x;
        moveZ -= forward.z;
      }
      if (keys.has('ArrowLeft')) {
        this.camera.rotation.y -= this.turnSpeed * 20;
      }
      if (keys.has('ArrowRight')) {
        this.camera.rotation.y += this.turnSpeed * 20;
      }
      
      // Check if running (shift key)
      const isRunning = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const currentSpeed = isRunning ? this.runSpeed : this.walkSpeed;
      
      // Normalize and apply speed
      const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
      if (moveLength > 0) {
        this.velocity.x = (moveX / moveLength) * currentSpeed;
        this.velocity.z = (moveZ / moveLength) * currentSpeed;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    });
  }
  
  private getBlockAt(x: number, y: number, z: number): number {
    // Determine which chunk this position is in
    const chunkX = Math.floor(x / CHUNK_WIDTH);
    const chunkZ = Math.floor(z / CHUNK_DEPTH);
    
    const chunk = this.chunks.get(`${chunkX}_0_${chunkZ}`);
    if (!chunk) return BlockId.AIR;
    
    // Convert to local chunk coordinates
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = Math.floor(y);
    const localZ = ((z % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
    
    if (localY < 0 || localY >= CHUNK_HEIGHT) {
      return BlockId.AIR;
    }
    
    return chunk.getBlockId(Math.floor(localX), localY, Math.floor(localZ));
  }
  
  private checkCollision(position: Vector3): boolean {
    // Check if player would collide at given position
    const minX = Math.floor(position.x - 0.3);
    const maxX = Math.floor(position.x + 0.3);
    const minY = Math.floor(position.y - this.playerHeight);
    const maxY = Math.floor(position.y);
    const minZ = Math.floor(position.z - 0.3);
    const maxZ = Math.floor(position.z + 0.3);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.getBlockAt(x, y, z) !== BlockId.AIR) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private startMining(): void {
    // First check for tree meshes
    const ray = new Ray(this.camera.position, this.camera.getForwardRay().direction, 5);
    const pickInfo = this.scene.pickWithRay(ray);
    
    if (pickInfo && pickInfo.hit && pickInfo.pickedMesh) {
      // Check if we hit a tree trunk
      if (pickInfo.pickedMesh.name.includes('trunk')) {
        // Give wood blocks when mining trees
        const woodCount = 3 + Math.floor(Math.random() * 3); // 3-5 wood blocks
        const currentCount = this.blockInventory.get(BlockId.WOOD) || 0;
        this.blockInventory.set(BlockId.WOOD, currentCount + woodCount);
        
        // Update inventory display if visible
        if (this.inventoryVisible) {
          this.updateInventoryDisplay();
        }
        
        // Remove the tree
        const treeMeshes = this.trees.filter(tree => 
          tree.name === pickInfo.pickedMesh!.name || 
          tree.name.replace('trunk', 'leaves') === pickInfo.pickedMesh!.name.replace('trunk', 'leaves')
        );
        
        treeMeshes.forEach(mesh => {
          mesh.dispose();
          const index = this.trees.indexOf(mesh);
          if (index > -1) {
            this.trees.splice(index, 1);
          }
        });
        
        // Also remove associated leaves
        const leavesName = pickInfo.pickedMesh.name.replace('trunk', 'leaves');
        const leavesMesh = this.trees.find(tree => tree.name === leavesName);
        if (leavesMesh) {
          leavesMesh.dispose();
          const index = this.trees.indexOf(leavesMesh);
          if (index > -1) {
            this.trees.splice(index, 1);
          }
        }
        
        return;
      }
    }
    
    // Otherwise check for regular blocks
    const hit = this.raycast();
    if (hit) {
      // Mine instantly
      this.mineBlock(hit.x, hit.y, hit.z);
    }
  }
  
  private stopMining(): void {
    // Not needed for instant mining
  }
  
  private raycast(): Vector3 | null {
    const ray = new Ray(this.camera.position, this.camera.getForwardRay().direction, 5);
    
    for (let distance = 0; distance < 5; distance += 0.1) {
      const point = ray.origin.add(ray.direction.scale(distance));
      const x = Math.floor(point.x);
      const y = Math.floor(point.y);
      const z = Math.floor(point.z);
      
      if (this.getBlockAt(x, y, z) !== BlockId.AIR) {
        // Update crosshair to show we can mine
        this.crosshair.color = "yellow";
        this.crosshair.thickness = 3;
        return new Vector3(x, y, z);
      }
    }
    
    // No target - reset crosshair
    this.crosshair.color = "white";
    this.crosshair.thickness = 2;
    return null;
  }
  
  private createMiningEffect(x: number, y: number, z: number): void {
    // Create a simple particle effect for mining
    const particleCount = 8;
    const particles: Mesh[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = MeshBuilder.CreateBox(`particle_${x}_${y}_${z}_${i}`, { size: 0.1 }, this.scene);
      particle.position = new Vector3(x + 0.5, y + 0.5, z + 0.5);
      
      // Set particle material
      const mat = new StandardMaterial(`particleMat_${i}`, this.scene);
      mat.diffuseColor = new Color3(0.6, 0.6, 0.6);
      mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
      particle.material = mat;
      
      particles.push(particle);
      
      // Random velocity
      const velocity = new Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.3 + 0.1,
        (Math.random() - 0.5) * 0.3
      );
      
      // Animate particle
      let lifetime = 0;
      const animation = this.scene.registerBeforeRender(() => {
        lifetime += 0.016; // Approximate 60fps
        
        if (lifetime > 0.5) {
          // Clean up after 0.5 seconds
          this.scene.unregisterBeforeRender(animation);
          particle.material?.dispose();
          particle.dispose();
          return;
        }
        
        // Apply physics
        velocity.y -= 0.5 * 0.016; // Gravity
        particle.position.addInPlace(velocity.scale(0.016 * 10));
        
        // Fade out
        particle.scaling = Vector3.One().scale(1 - lifetime * 2);
      });
    }
  }
  
  private placeBlock(x: number, y: number, z: number, blockType: BlockId): void {
    // Check if we have the block in inventory
    const count = this.blockInventory.get(blockType) || 0;
    if (count <= 0) return;
    
    // Calculate chunk coordinates
    const chunkX = Math.floor(x / CHUNK_WIDTH);
    const chunkZ = Math.floor(z / CHUNK_DEPTH);
    const key = `${chunkX}_0_${chunkZ}`;
    const chunk = this.chunks.get(key);
    
    if (chunk) {
      const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
      const localZ = ((z % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
      
      // Check if position is empty
      const currentBlock = chunk.getBlockId(Math.floor(localX), y, Math.floor(localZ));
      if (currentBlock === BlockId.AIR) {
        // Place block
        chunk.setBlockId(Math.floor(localX), y, Math.floor(localZ), blockType);
        
        // Remove from inventory
        this.blockInventory.set(blockType, count - 1);
        this.updateInventoryDisplay();
        
        // Create mesh for the new block
        const box = MeshBuilder.CreateBox(`block_${x}_${y}_${z}`, { size: 1 }, this.scene);
        box.position = new Vector3(x + 0.5, y + 0.5, z + 0.5);
        box.material = this.getOrCreateBlockMaterial(blockType);
        
        // Add to chunk meshes
        const chunkMeshes = this.chunkMeshes.get(key) || [];
        chunkMeshes.push(box);
        this.chunkMeshes.set(key, chunkMeshes);
      }
    }
  }
  
  private mineBlock(x: number, y: number, z: number): void {
    // Remove block from chunk
    const chunkX = Math.floor(x / CHUNK_WIDTH);
    const chunkZ = Math.floor(z / CHUNK_DEPTH);
    const key = `${chunkX}_0_${chunkZ}`;
    const chunk = this.chunks.get(key);
    
    if (chunk) {
      const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
      const localZ = ((z % CHUNK_DEPTH) + CHUNK_DEPTH) % CHUNK_DEPTH;
      
      const blockId = chunk.getBlockId(Math.floor(localX), y, Math.floor(localZ));
      
      if (blockId !== BlockId.AIR && blockId !== BlockId.BEDROCK) {
        // Add to inventory
        const currentCount = this.blockInventory.get(blockId) || 0;
        this.blockInventory.set(blockId, currentCount + 1);
        this.updateInventoryDisplay();
        
        // Remove block
        chunk.setBlockId(Math.floor(localX), y, Math.floor(localZ), BlockId.AIR);
        
        // Create puff of smoke effect
        this.createMiningEffect(x, y, z);
        
        // Performance optimization: Only update affected blocks
        // 1. Remove the mined block mesh
        const meshName = `block_${x}_${y}_${z}`;
        const mesh = this.scene.getMeshByName(meshName);
        if (mesh) {
          mesh.dispose();
          const chunkMeshes = this.chunkMeshes.get(key);
          if (chunkMeshes) {
            const index = chunkMeshes.indexOf(mesh as Mesh);
            if (index > -1) {
              chunkMeshes.splice(index, 1);
            }
          }
        }
        
        // 2. Check and render newly exposed neighbor blocks
        this.renderExposedNeighbors(chunk, Math.floor(localX), y, Math.floor(localZ), key);
      }
    }
  }
  
  private renderExposedNeighbors(chunk: Chunk, x: number, y: number, z: number, chunkKey: string): void {
    const neighbors = [
      { dx: -1, dy: 0, dz: 0 },
      { dx: 1, dy: 0, dz: 0 },
      { dx: 0, dy: -1, dz: 0 },
      { dx: 0, dy: 1, dz: 0 },
      { dx: 0, dy: 0, dz: -1 },
      { dx: 0, dy: 0, dz: 1 }
    ];
    
    const [chunkX, , chunkZ] = chunkKey.split('_').map(Number);
    const chunkMeshes = this.chunkMeshes.get(chunkKey) || [];
    
    for (const { dx, dy, dz } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      
      // Skip if out of bounds
      if (nx < 0 || nx >= CHUNK_WIDTH || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_DEPTH) {
        continue;
      }
      
      const neighborBlockId = chunk.getBlockId(nx, ny, nz);
      if (neighborBlockId !== BlockId.AIR) {
        // Check if this block mesh already exists
        const worldX = chunkX * CHUNK_WIDTH + nx;
        const worldZ = chunkZ * CHUNK_DEPTH + nz;
        const meshName = `block_${worldX}_${ny}_${worldZ}`;
        
        if (!this.scene.getMeshByName(meshName)) {
          // Create mesh for this newly exposed block
          const box = MeshBuilder.CreateBox(meshName, { size: 1 }, this.scene);
          box.position = new Vector3(worldX + 0.5, ny + 0.5, worldZ + 0.5);
          box.material = this.getOrCreateBlockMaterial(neighborBlockId);
          chunkMeshes.push(box);
        }
      }
    }
    
    // Update the chunk meshes if we added any
    if (!this.chunkMeshes.has(chunkKey)) {
      this.chunkMeshes.set(chunkKey, chunkMeshes);
    }
  }
  
  private startGameLoop(): void {
    let lastTime = performance.now();
    let lastChunkCheckTime = 0;
    let initialized = false;
    
    this.scene.registerBeforeRender(() => {
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;
      
      // First frame initialization - ensure player is on ground
      if (!initialized) {
        initialized = true;
        const groundY = this.getHeightAt(this.camera.position.x, this.camera.position.z);
        if (groundY > 0) {
          this.camera.position.y = groundY + this.playerHeight + 0.5;
          this.velocity.y = 0;
          console.log(`Initial position adjusted to ground at y=${groundY}`);
        }
      }
      
      // Check if we need to generate new chunks (every 500ms) - only if enabled
      if (this.autoGenerateChunks && now - lastChunkCheckTime > 500) {
        lastChunkCheckTime = now;
        this.loadChunksAroundPlayer();
      }
      
      // Update chickens
      if (this.chickensEnabled && this.chickens.length > 0) {
        this.updateChickens(deltaTime);
      }
      
      // Update villagers
      if (this.villagersEnabled && this.villagers.length > 0) {
        this.updateVillagers(deltaTime);
      }
      
      // Update crosshair targeting
      this.raycast();
      
      // Apply gravity
      if (!this.isGrounded) {
        this.velocity.y += this.gravity * deltaTime;
      }
      
      // Check ground
      const groundCheck = new Vector3(
        this.camera.position.x,
        this.camera.position.y - this.playerHeight - 0.1,
        this.camera.position.z
      );
      
      this.isGrounded = this.checkCollision(groundCheck);
      if (this.isGrounded && this.velocity.y < 0) {
        this.velocity.y = 0;
      }
      
      // Apply velocity
      const newPos = this.camera.position.add(this.velocity.scale(deltaTime));
      
      // Check collisions for each axis separately
      const testX = new Vector3(newPos.x, this.camera.position.y, this.camera.position.z);
      if (!this.checkCollision(testX)) {
        this.camera.position.x = newPos.x;
      }
      
      const testY = new Vector3(this.camera.position.x, newPos.y, this.camera.position.z);
      if (!this.checkCollision(testY)) {
        this.camera.position.y = newPos.y;
      } else if (this.velocity.y < 0) {
        // Hit ground
        this.velocity.y = 0;
        this.isGrounded = true;
      }
      
      const testZ = new Vector3(this.camera.position.x, this.camera.position.y, newPos.z);
      if (!this.checkCollision(testZ)) {
        this.camera.position.z = newPos.z;
      }
      
      // Auto-step up small heights
      if (this.isGrounded) {
        const stepUp = new Vector3(this.camera.position.x, this.camera.position.y + 0.6, this.camera.position.z);
        const stepForward = new Vector3(newPos.x, this.camera.position.y + 0.6, newPos.z);
        
        if (!this.checkCollision(stepUp) && !this.checkCollision(stepForward)) {
          // Can step up
          const groundAbove = new Vector3(newPos.x, this.camera.position.y + 0.1, newPos.z);
          if (this.checkCollision(groundAbove)) {
            this.camera.position.x = newPos.x;
            this.camera.position.z = newPos.z;
            this.camera.position.y += 0.6;
          }
        }
      }
    });
    
    // Start render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    // Handle resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
  }
  
  start(): void {
    console.log('Starting game...');
    
    // Hide loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
      console.log('Game started! Use WASD to move, Shift to run, Space to jump, Arrow keys to turn, Click to capture mouse');
    }
  }
  
  // Chicken-related methods
  private initializeChickenTexture(): void {
    try {
      // Load the chicken texture
      this.chickenTexture = new Texture('/src/assets/chicken_32.png', this.scene);
      this.chickenTexture.hasAlpha = true;
      
      console.log('Chicken texture loaded');
    } catch (error) {
      console.error('Failed to load chicken texture:', error);
    }
  }
  
  private toggleChickens(): void {
    this.chickensEnabled = !this.chickensEnabled;
    
    if (this.chickensEnabled) {
      this.spawnChickens();
      console.log('Chickens enabled');
    } else {
      this.removeAllChickens();
      console.log('Chickens disabled');
    }
  }
  
  private spawnChickens(): void {
    // Remove existing chickens first
    this.removeAllChickens();
    
    // Get bounds of generated chunks
    const bounds = this.getGeneratedChunkBounds();
    const playerPos = this.camera.position;
    
    let attempts = 0;
    const maxAttempts = this.maxChickens * 3; // Allow multiple attempts to find valid positions
    
    for (let i = 0; i < this.maxChickens && attempts < maxAttempts; i++) {
      attempts++;
      
      // Random position around player but within chunk bounds
      const angle = Math.random() * Math.PI * 2;
      const distance = 5 + Math.random() * 15;
      let x = playerPos.x + Math.cos(angle) * distance;
      let z = playerPos.z + Math.sin(angle) * distance;
      
      // Clamp to generated chunk bounds with margin
      x = Math.max(bounds.minX + 2, Math.min(bounds.maxX - 2, x));
      z = Math.max(bounds.minZ + 2, Math.min(bounds.maxZ - 2, z));
      
      // Check if position is in a generated chunk
      if (!this.isPositionInGeneratedChunk(x, z)) {
        i--; // Try again
        continue;
      }
      
      const y = this.getHeightAt(x, z) + 0.5;
      
      // Skip if in water or too high
      if (y <= this.waterLevel || y > 30) {
        i--; // Try again
        continue;
      }
      
      // Create chicken mesh with separate faces
      const chickenMesh = MeshBuilder.CreateBox(`chicken_${i}`, { 
        size: 0.8,
        faceUV: [
          new Vector4(0, 0, 1, 1), // Front face
          new Vector4(0, 0, 0, 0), // Back face (no texture)
          new Vector4(0, 0, 0, 0), // Right face (no texture)
          new Vector4(0, 0, 0, 0), // Left face (no texture)
          new Vector4(0, 0, 0, 0), // Top face (no texture)
          new Vector4(0, 0, 0, 0)  // Bottom face (no texture)
        ]
      }, this.scene);
      chickenMesh.position = new Vector3(x, y, z);
      
      // Create multi-material for chicken
      const multiMat = new MultiMaterial(`chickenMultiMat_${i}`, this.scene);
      
      // Face material (with texture)
      const faceMat = new StandardMaterial(`chickenFaceMat_${i}`, this.scene);
      if (this.chickenTexture) {
        faceMat.diffuseTexture = this.chickenTexture;
        // Flip texture vertically
        faceMat.diffuseTexture.vScale = -1;
        faceMat.emissiveColor = new Color3(0.1, 0.1, 0.1);
      } else {
        faceMat.diffuseColor = new Color3(1, 0.8, 0.2);
      }
      
      // Body material (solid color)
      const bodyMat = new StandardMaterial(`chickenBodyMat_${i}`, this.scene);
      bodyMat.diffuseColor = new Color3(1, 0.9, 0.3); // Yellow body
      
      // Assign materials to faces
      multiMat.subMaterials = [
        faceMat,  // Front face (0)
        bodyMat,  // Back face (1)
        bodyMat,  // Right face (2)
        bodyMat,  // Left face (3)
        bodyMat,  // Top face (4)
        bodyMat   // Bottom face (5)
      ];
      
      chickenMesh.material = multiMat;
      chickenMesh.subMeshes = [];
      chickenMesh.subMeshes.push(new SubMesh(0, 0, 4, 0, 6, chickenMesh)); // Front face
      chickenMesh.subMeshes.push(new SubMesh(1, 4, 4, 6, 6, chickenMesh)); // Back face
      chickenMesh.subMeshes.push(new SubMesh(2, 8, 4, 12, 6, chickenMesh)); // Right face
      chickenMesh.subMeshes.push(new SubMesh(3, 12, 4, 18, 6, chickenMesh)); // Left face
      chickenMesh.subMeshes.push(new SubMesh(4, 16, 4, 24, 6, chickenMesh)); // Top face
      chickenMesh.subMeshes.push(new SubMesh(5, 20, 4, 30, 6, chickenMesh)); // Bottom face
      
      // Create chicken object
      const chicken: Chicken = {
        mesh: chickenMesh,
        position: new Vector3(x, y, z),
        velocity: Vector3.Zero(),
        state: 'pausing',
        stateTimer: Math.random() * 2,
        targetDirection: Math.random() * Math.PI * 2
      };
      
      this.chickens.push(chicken);
    }
  }
  
  private removeAllChickens(): void {
    for (const chicken of this.chickens) {
      chicken.mesh.dispose();
    }
    this.chickens = [];
  }
  
  private updateChickens(deltaTime: number): void {
    for (const chicken of this.chickens) {
      // Update state timer
      chicken.stateTimer -= deltaTime;
      
      // State machine
      switch (chicken.state) {
        case 'pausing':
          if (chicken.stateTimer <= 0) {
            // Transition to walking or pecking
            if (Math.random() < 0.7) {
              chicken.state = 'walking';
              chicken.targetDirection = Math.random() * Math.PI * 2;
              chicken.stateTimer = 1 + Math.random() * 2;
            } else {
              chicken.state = 'pecking';
              chicken.stateTimer = 0.5 + Math.random() * 0.5;
            }
          }
          break;
          
        case 'walking':
          // Move in target direction
          const speed = 1.5;
          chicken.velocity.x = Math.cos(chicken.targetDirection) * speed;
          chicken.velocity.z = Math.sin(chicken.targetDirection) * speed;
          
          // Update position
          chicken.position.x += chicken.velocity.x * deltaTime;
          chicken.position.z += chicken.velocity.z * deltaTime;
          
          // Keep on ground
          const groundY = this.getHeightAt(chicken.position.x, chicken.position.z);
          chicken.position.y = groundY + 0.5;
          
          // Face movement direction
          chicken.mesh.rotation.y = chicken.targetDirection;
          
          // Transition to pause
          if (chicken.stateTimer <= 0) {
            chicken.state = 'pausing';
            chicken.stateTimer = 1 + Math.random() * 2;
            chicken.velocity = Vector3.Zero();
          }
          break;
          
        case 'pecking':
          // Pecking animation (tilt forward)
          const peckPhase = Math.sin(chicken.stateTimer * 10);
          chicken.mesh.rotation.x = Math.abs(peckPhase) * 0.3;
          
          // Transition to pause
          if (chicken.stateTimer <= 0) {
            chicken.mesh.rotation.x = 0;
            chicken.state = 'pausing';
            chicken.stateTimer = 0.5 + Math.random() * 1;
          }
          break;
      }
      
      // Update mesh position
      chicken.mesh.position.copyFrom(chicken.position);
      
      // Small bobbing animation while walking
      if (chicken.state === 'walking') {
        chicken.mesh.position.y += Math.sin(performance.now() * 0.01 + chicken.mesh.id.charCodeAt(0)) * 0.05;
      }
    }
  }
  
  // Villager-related methods
  private initializeVillagerTextures(): void {
    try {
      // Import and create villager textures
      import('./utils/createVillagerTextures').then(module => {
        const faceDataUrl = module.createVillagerFaceTexture();
        const bodyDataUrl = module.createVillagerBodyTexture();
        const sideDataUrl = module.createVillagerSideTexture();
        
        this.villagerFaceTexture = new Texture(faceDataUrl, this.scene);
        this.villagerBodyTexture = new Texture(bodyDataUrl, this.scene);
        this.villagerSideTexture = new Texture(sideDataUrl, this.scene);
        
        console.log('Villager textures created');
      });
    } catch (error) {
      console.error('Failed to create villager textures:', error);
    }
  }
  
  private toggleVillagers(): void {
    this.villagersEnabled = !this.villagersEnabled;
    
    if (this.villagersEnabled) {
      // Use world's people density if set, otherwise use a default of 5
      const numVillagers = this.peopleDensity > 0 ? 
        Math.floor(this.peopleDensity) : 
        5; // Default to 5 villagers if density is 0
      this.spawnVillagers(numVillagers);
      console.log(`Villagers enabled (spawning ${numVillagers})`);
    } else {
      this.removeAllVillagers();
      console.log('Villagers disabled');
    }
  }
  
  private spawnVillagers(count: number): void {
    // Remove existing villagers first
    this.removeAllVillagers();
    
    // Get bounds of generated chunks
    const bounds = this.getGeneratedChunkBounds();
    const playerPos = this.camera.position;
    
    let attempts = 0;
    const maxAttempts = count * 3; // Allow multiple attempts to find valid positions
    
    for (let i = 0; i < Math.min(count, this.maxVillagers) && attempts < maxAttempts; i++) {
      attempts++;
      
      // Random position around player but within chunk bounds
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * 20;
      let x = playerPos.x + Math.cos(angle) * distance;
      let z = playerPos.z + Math.sin(angle) * distance;
      
      // Clamp to generated chunk bounds with margin
      x = Math.max(bounds.minX + 2, Math.min(bounds.maxX - 2, x));
      z = Math.max(bounds.minZ + 2, Math.min(bounds.maxZ - 2, z));
      
      // Check if position is in a generated chunk
      if (!this.isPositionInGeneratedChunk(x, z)) {
        i--; // Try again
        continue;
      }
      
      const y = this.getHeightAt(x, z);
      
      // Skip if in water or too high
      if (y <= this.waterLevel || y > 30) {
        i--; // Try again
        continue;
      }
      
      // Create villager body (lower block)
      const bodyMesh = MeshBuilder.CreateBox(`villager_body_${i}`, { 
        width: 0.6,
        height: 1,
        depth: 0.4
      }, this.scene);
      bodyMesh.position = new Vector3(x, y + 0.5, z);
      
      // Apply body texture with multi-material
      const bodyMultiMat = new MultiMaterial(`villagerBodyMultiMat_${i}`, this.scene);
      
      // Front material (with detailed texture)
      const bodyFrontMat = new StandardMaterial(`villagerBodyFrontMat_${i}`, this.scene);
      if (this.villagerBodyTexture) {
        bodyFrontMat.diffuseTexture = this.villagerBodyTexture;
        // Flip texture vertically for front
        bodyFrontMat.diffuseTexture.vScale = -1;
      } else {
        bodyFrontMat.diffuseColor = new Color3(0.3, 0.5, 0.3); // Green tunic fallback
      }
      
      // Back material (same texture but not flipped)
      const bodyBackMat = new StandardMaterial(`villagerBodyBackMat_${i}`, this.scene);
      if (this.villagerBodyTexture) {
        bodyBackMat.diffuseTexture = this.villagerBodyTexture.clone();
        // Don't flip for back - it's already correct orientation
        bodyBackMat.diffuseTexture.vScale = 1;
      } else {
        bodyBackMat.diffuseColor = new Color3(0.3, 0.5, 0.3); // Green tunic fallback
      }
      
      // Side material (simple shirt/pants)
      const bodySideMat = new StandardMaterial(`villagerBodySideMat_${i}`, this.scene);
      if (this.villagerSideTexture) {
        bodySideMat.diffuseTexture = this.villagerSideTexture.clone();
        // Rotate 90 degrees for sides
        bodySideMat.diffuseTexture.uAng = Math.PI / 2;
        bodySideMat.diffuseTexture.vScale = -1;
      } else {
        bodySideMat.diffuseColor = new Color3(0.35, 0.55, 0.35); // Slightly different green
      }
      
      bodyMultiMat.subMaterials = [
        bodyFrontMat,  // Front face
        bodyBackMat,   // Back face (not flipped)
        bodySideMat,   // Right face (rotated)
        bodySideMat,   // Left face (rotated)
        bodySideMat,   // Top face
        bodySideMat    // Bottom face
      ];
      
      bodyMesh.material = bodyMultiMat;
      bodyMesh.subMeshes = [];
      bodyMesh.subMeshes.push(new SubMesh(0, 0, 4, 0, 6, bodyMesh));
      bodyMesh.subMeshes.push(new SubMesh(1, 4, 4, 6, 6, bodyMesh));
      bodyMesh.subMeshes.push(new SubMesh(2, 8, 4, 12, 6, bodyMesh));
      bodyMesh.subMeshes.push(new SubMesh(3, 12, 4, 18, 6, bodyMesh));
      bodyMesh.subMeshes.push(new SubMesh(4, 16, 4, 24, 6, bodyMesh));
      bodyMesh.subMeshes.push(new SubMesh(5, 20, 4, 30, 6, bodyMesh));
      
      // Create villager head (upper block)
      const headMesh = MeshBuilder.CreateBox(`villager_head_${i}`, {
        width: 0.5,
        height: 0.5,
        depth: 0.5
      }, this.scene);
      headMesh.position = new Vector3(x, y + 1.25, z);
      
      // Apply head texture to front face only
      const headMultiMat = new MultiMaterial(`villagerHeadMultiMat_${i}`, this.scene);
      
      // Face material (with texture)
      const faceMat = new StandardMaterial(`villagerFaceMat_${i}`, this.scene);
      if (this.villagerFaceTexture) {
        faceMat.diffuseTexture = this.villagerFaceTexture;
        // Flip texture vertically
        faceMat.diffuseTexture.vScale = -1;
      } else {
        faceMat.diffuseColor = new Color3(0.95, 0.75, 0.6); // Skin color fallback
      }
      
      // Side/back material (hair color)
      const hairMat = new StandardMaterial(`villagerHairMat_${i}`, this.scene);
      hairMat.diffuseColor = new Color3(0.4, 0.2, 0.1); // Brown hair
      
      headMultiMat.subMaterials = [
        faceMat,  // Front face
        hairMat,  // Back face
        hairMat,  // Right face
        hairMat,  // Left face
        hairMat,  // Top face
        hairMat   // Bottom face
      ];
      
      headMesh.material = headMultiMat;
      headMesh.subMeshes = [];
      headMesh.subMeshes.push(new SubMesh(0, 0, 4, 0, 6, headMesh));
      headMesh.subMeshes.push(new SubMesh(1, 4, 4, 6, 6, headMesh));
      headMesh.subMeshes.push(new SubMesh(2, 8, 4, 12, 6, headMesh));
      headMesh.subMeshes.push(new SubMesh(3, 12, 4, 18, 6, headMesh));
      headMesh.subMeshes.push(new SubMesh(4, 16, 4, 24, 6, headMesh));
      headMesh.subMeshes.push(new SubMesh(5, 20, 4, 30, 6, headMesh));
      
      // Create nose (small cube protruding from face)
      const noseMesh = MeshBuilder.CreateBox(`villager_nose_${i}`, {
        width: 0.1,
        height: 0.1,
        depth: 0.15
      }, this.scene);
      // Position relative to parent (head), not absolute world position
      // Front face is -Z in Babylon.js default box orientation
      noseMesh.position = new Vector3(0, 0, 0.3); // Positioned in front of face (positive Z)
      noseMesh.parent = headMesh;
      
      const noseMat = new StandardMaterial(`villagerNoseMat_${i}`, this.scene);
      noseMat.diffuseColor = new Color3(0.9, 0.7, 0.55); // Slightly darker skin tone
      noseMesh.material = noseMat;
      
      // Create villager object
      const villager: Villager = {
        headMesh,
        bodyMesh,
        noseMesh,
        position: new Vector3(x, y, z),
        velocity: Vector3.Zero(),
        state: 'idle',
        stateTimer: Math.random() * 3,
        targetDirection: Math.random() * Math.PI * 2
      };
      
      this.villagers.push(villager);
    }
  }
  
  private removeAllVillagers(): void {
    for (const villager of this.villagers) {
      villager.headMesh.dispose();
      villager.bodyMesh.dispose();
      villager.noseMesh.dispose();
    }
    this.villagers = [];
  }
  
  private updateVillagers(deltaTime: number): void {
    for (const villager of this.villagers) {
      // Update state timer
      villager.stateTimer -= deltaTime;
      
      // State machine
      switch (villager.state) {
        case 'idle':
          // Small idle animation (subtle head movement)
          villager.headMesh.rotation.y = Math.sin(performance.now() * 0.001) * 0.1;
          
          if (villager.stateTimer <= 0) {
            // Transition to walking or talking
            const rand = Math.random();
            if (rand < 0.6) {
              villager.state = 'walking';
              villager.targetDirection = Math.random() * Math.PI * 2;
              villager.stateTimer = 2 + Math.random() * 3;
            } else {
              villager.state = 'talking';
              villager.stateTimer = 1 + Math.random() * 2;
            }
          }
          break;
          
        case 'walking':
          // Move in target direction (slower than chickens)
          const speed = 1.0;
          villager.velocity.x = Math.cos(villager.targetDirection) * speed;
          villager.velocity.z = Math.sin(villager.targetDirection) * speed;
          
          // Update position
          villager.position.x += villager.velocity.x * deltaTime;
          villager.position.z += villager.velocity.z * deltaTime;
          
          // Keep on ground
          const groundY = this.getHeightAt(villager.position.x, villager.position.z);
          villager.position.y = groundY;
          
          // Face movement direction
          const rotation = villager.targetDirection;
          villager.headMesh.rotation.y = rotation;
          villager.bodyMesh.rotation.y = rotation;
          
          // Walking animation (slight bobbing)
          const bobAmount = Math.sin(performance.now() * 0.005) * 0.05;
          villager.headMesh.position.x = villager.position.x;
          villager.headMesh.position.y = villager.position.y + 1.25 + bobAmount;
          villager.headMesh.position.z = villager.position.z;
          villager.bodyMesh.position.x = villager.position.x;
          villager.bodyMesh.position.y = villager.position.y + 0.5 + bobAmount;
          villager.bodyMesh.position.z = villager.position.z;
          
          // Transition back to idle
          if (villager.stateTimer <= 0) {
            villager.state = 'idle';
            villager.stateTimer = 2 + Math.random() * 3;
            villager.velocity = Vector3.Zero();
          }
          break;
          
        case 'talking':
          // Talking animation (head nodding)
          const nodPhase = Math.sin(villager.stateTimer * 8);
          villager.headMesh.rotation.x = Math.abs(nodPhase) * 0.15;
          
          // Transition back to idle
          if (villager.stateTimer <= 0) {
            villager.headMesh.rotation.x = 0;
            villager.state = 'idle';
            villager.stateTimer = 1 + Math.random() * 2;
          }
          break;
      }
      
      // Update mesh positions
      if (villager.state !== 'walking') {
        villager.headMesh.position.x = villager.position.x;
        villager.headMesh.position.z = villager.position.z;
        villager.bodyMesh.position.x = villager.position.x;
        villager.bodyMesh.position.z = villager.position.z;
        
        if (villager.state !== 'talking') {
          villager.headMesh.position.y = villager.position.y + 1.25;
        }
        villager.bodyMesh.position.y = villager.position.y + 0.5;
      }
    }
  }
}

// Initialize game
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing game...');
  
  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  try {
    const game = new SimpleGame(canvas);
    
    // Start after a short delay to ensure everything is loaded
    setTimeout(() => {
      game.start();
    }, 100);
    
  } catch (error) {
    console.error('Failed to start game:', error);
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.textContent = 'Error loading game. Check console for details.';
    }
  }
});