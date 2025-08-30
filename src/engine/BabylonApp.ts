import { 
  Engine, 
  Scene, 
  HemisphericLight, 
  Vector3, 
  StandardMaterial, 
  Texture,
  Color3,
  MeshBuilder,
  Mesh
} from '@babylonjs/core';
import { World } from '../world/World';
import { WorldGenerator } from '../world/WorldGen';
import { ChunkMesher } from '../world/ChunkMesh';
import { Player } from '../game/Player';
import { InputManager } from './Input';
import { WorldSettings } from '../types';
import { Chunk } from '../world/Chunk';

export class BabylonApp {
  private engine: Engine;
  private scene: Scene;
  private world: World;
  private player: Player;
  private input: InputManager;
  private chunkMeshes: Map<string, Mesh> = new Map();
  private material: StandardMaterial;
  private lastUpdateTime: number = 0;
  private viewDistance: number = 3; // Reduced from 8 for better performance
  
  constructor(canvas: HTMLCanvasElement) {
    console.log('Initializing BabylonApp...');
    
    try {
      this.engine = new Engine(canvas, true);
      this.scene = new Scene(this.engine);
      
      const defaultSettings: WorldSettings = {
        seed: Date.now(),
        mountainous: 0.5,
        roughness: 0.5,
        moisture: 0.5,
        temperature: 0.5,
        trees: 0.3,
        lavaPockets: 0.2,
        biomeMix: 'Balanced',
        surprises: false
      };
      
      this.world = new World(defaultSettings);
      this.player = new Player(this.scene, this.world);
      this.input = new InputManager(this.scene, this.player, this.world);
      
      this.material = this.createBlockMaterial();
      this.createWaterPlane();
      
      this.setupScene();
      this.generateWorld();
      this.setupRenderLoop();
      
      console.log('BabylonApp initialized successfully');
    } catch (error) {
      console.error('Error initializing BabylonApp:', error);
      throw error;
    }
  }
  
  private setupScene(): void {
    this.scene.clearColor = new Color3(0.5, 0.7, 1).toColor4();
    
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.8;
    light.groundColor = new Color3(0.2, 0.2, 0.3);
    
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.7, 0.8, 0.9);
    this.scene.fogStart = 100;
    this.scene.fogEnd = 300;
    
    this.scene.registerBeforeRender(() => {
      const now = Date.now();
      const deltaTime = (now - this.lastUpdateTime) / 1000;
      this.lastUpdateTime = now;
      
      this.update(deltaTime);
    });
  }
  
  private createBlockMaterial(): StandardMaterial {
    const material = new StandardMaterial('blockMaterial', this.scene);
    
    material.diffuseTexture = this.createTextureAtlas();
    material.specularColor = new Color3(0, 0, 0);
    material.emissiveColor = new Color3(0, 0, 0);
    material.ambientColor = new Color3(1, 1, 1);
    
    return material;
  }
  
  private createTextureAtlas(): Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    const tileSize = 16;
    const colors = [
      '#7EC850',
      '#8B7355',
      '#654321',
      '#8B4513',
      '#808080',
      '#2C2C2C',
      '#FF4500',
      '#FFD700',
      '#FFA500',
      '#A0522D',
      '#8B7D6B'
    ];
    
    colors.forEach((color, index) => {
      const x = (index % 16) * tileSize;
      const y = Math.floor(index / 16) * tileSize;
      
      ctx.fillStyle = color;
      ctx.fillRect(x, y, tileSize, tileSize);
      
      if (index === 7) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 4, y + 4, 2, 2);
        ctx.fillRect(x + 10, y + 4, 2, 2);
        ctx.fillRect(x + 7, y + 10, 2, 2);
      }
    });
    
    const texture = new Texture(canvas.toDataURL(), this.scene);
    texture.hasAlpha = false;
    
    return texture;
  }
  
  private createWaterPlane(): Mesh {
    const water = MeshBuilder.CreateGround('water', {
      width: 2048,
      height: 2048,
      subdivisions: 32
    }, this.scene);
    
    water.position.y = 0;
    
    const waterMaterial = new StandardMaterial('waterMaterial', this.scene);
    waterMaterial.diffuseColor = new Color3(0.1, 0.3, 0.6);
    waterMaterial.specularColor = new Color3(0.5, 0.5, 0.5);
    waterMaterial.alpha = 0.6;
    waterMaterial.backFaceCulling = false;
    
    water.material = waterMaterial;
    
    return water;
  }
  
  private generateWorld(): void {
    console.log('Starting world generation...');
    const generator = new WorldGenerator(this.world);
    
    // Only generate a small area around spawn point initially
    const spawnPos = { x: 512, z: 512 };
    generator.generateAroundPosition(spawnPos, 64); // Reduced from 128
    
    console.log('Initial chunks generated');
    
    // Find a suitable spawn height
    const playerPos = this.player.getState().position;
    let spawned = false;
    for (let y = 50; y >= -20; y--) {
      if (!this.world.isSolid({ x: playerPos.x, y, z: playerPos.z })) {
        this.player.getCamera().position.y = y + 2;
        console.log(`Player spawned at height ${y + 2}`);
        spawned = true;
        break;
      }
    }
    
    if (!spawned) {
      // Fallback if no suitable spawn found
      this.player.getCamera().position.y = 60;
      console.log('Using fallback spawn height');
    }
  }
  
  private update(deltaTime: number): void {
    this.input.update();
    this.player.update(deltaTime);
    this.updateChunkMeshes();
  }
  
  private updateChunkMeshes(): void {
    const playerPos = this.player.getState().position;
    const viewDistanceBlocks = this.viewDistance * 32;
    
    // DON'T generate terrain every frame! This was the problem
    // Only get existing chunks
    const chunks = this.world.getChunksInRadius(playerPos, viewDistanceBlocks);
    
    const activeChunkKeys = new Set<string>();
    
    chunks.forEach(chunk => {
      const key = this.getChunkKey(chunk);
      activeChunkKeys.add(key);
      
      if (chunk.needsRemesh() || !this.chunkMeshes.has(key)) {
        this.remeshChunk(chunk);
      }
    });
    
    this.chunkMeshes.forEach((mesh, key) => {
      if (!activeChunkKeys.has(key)) {
        mesh.dispose();
        this.chunkMeshes.delete(key);
      }
    });
  }
  
  private remeshChunk(chunk: Chunk): void {
    const key = this.getChunkKey(chunk);
    
    const existingMesh = this.chunkMeshes.get(key);
    if (existingMesh) {
      existingMesh.dispose();
    }
    
    const mesh = ChunkMesher.createChunkMesh(chunk, this.world, this.scene, this.material);
    
    if (mesh) {
      this.chunkMeshes.set(key, mesh);
    } else {
      this.chunkMeshes.delete(key);
    }
  }
  
  private getChunkKey(chunk: Chunk): string {
    const coord = chunk.getCoord();
    return `${coord.x}_${chunk.getYOffset()}_${coord.z}`;
  }
  
  private setupRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    window.addEventListener('resize', () => {
      this.engine.resize();
    });
    
    this.input.onBreakBlock(() => {
      const chunks = this.world.getChunksInRadius(
        this.player.getState().position,
        this.viewDistance * 32
      );
      chunks.forEach(chunk => {
        if (chunk.needsRemesh()) {
          this.remeshChunk(chunk);
        }
      });
    });
    
    this.input.onPlaceBlock(() => {
      const chunks = this.world.getChunksInRadius(
        this.player.getState().position,
        this.viewDistance * 32
      );
      chunks.forEach(chunk => {
        if (chunk.needsRemesh()) {
          this.remeshChunk(chunk);
        }
      });
    });
  }
  
  regenerateWorld(settings: WorldSettings): void {
    this.chunkMeshes.forEach(mesh => mesh.dispose());
    this.chunkMeshes.clear();
    
    this.world.clear();
    this.world = new World(settings);
    
    const generator = new WorldGenerator(this.world);
    generator.generateWorld();
    
    this.player.respawn();
  }
  
  start(): void {
    console.log('Starting game...');
    
    // Debug: Check canvas state
    const canvas = this.engine.getRenderingCanvas();
    console.log('Canvas:', canvas);
    console.log('Canvas size:', canvas?.width, 'x', canvas?.height);
    console.log('Scene ready:', this.scene.isReady());
    console.log('Active meshes:', this.scene.meshes.length);
    
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      console.log('Hiding loading screen');
      loadingScreen.classList.add('hidden');
      // Fallback: directly set display none
      loadingScreen.style.display = 'none';
      console.log('Loading screen hidden, classes:', loadingScreen.className);
      console.log('Loading screen display style:', loadingScreen.style.display);
      console.log('Loading screen computed style:', window.getComputedStyle(loadingScreen).display);
    } else {
      console.warn('Loading screen element not found');
    }
  }
}