import { Scene } from '@babylonjs/core';
import { Player } from '../game/Player';
import { World } from '../world/World';

export class InputManager {
  private keys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private player: Player;
  private world: World;
  private scene: Scene;
  private isPointerLocked: boolean = false;
  private breakCallback?: (pos: any) => void;
  private placeCallback?: (pos: any, blockId: number) => void;
  
  constructor(scene: Scene, player: Player, world: World) {
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (!canvas) return;
    
    canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });
    
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });
    
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      
      if (e.code === 'Space') {
        e.preventDefault();
        this.player.jump();
      }
      
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const index = parseInt(e.code.replace('Digit', '')) - 1;
        this.player.setHotbarIndex(index);
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    
    canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button);
      
      if (e.button === 0) {
        this.handleBreakBlock();
      } else if (e.button === 2) {
        e.preventDefault();
        this.handlePlaceBlock();
      }
    });
    
    canvas.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button);
    });
    
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    
    canvas.addEventListener('wheel', (e) => {
      const delta = Math.sign(e.deltaY);
      const currentIndex = this.player.getState().hotbarIndex;
      const newIndex = (currentIndex + delta + 9) % 9;
      this.player.setHotbarIndex(newIndex);
    });
  }
  
  update(): void {
    if (!this.isPointerLocked) return;
    
    let moveX = 0;
    let moveZ = 0;
    
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      moveZ = 1;
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      moveZ = -1;
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      moveX = -1;
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      moveX = 1;
    }
    
    if (moveX === 0 && moveZ === 0) {
      this.player.stopMoving();
    } else {
      if (moveZ > 0) {
        this.player.moveForward();
      } else if (moveZ < 0) {
        this.player.moveBackward();
      }
      
      if (moveX < 0) {
        this.player.moveLeft();
      } else if (moveX > 0) {
        this.player.moveRight();
      }
    }
    
    this.player.setSprinting(this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
  }
  
  private handleBreakBlock(): void {
    const hit = this.player.raycast();
    if (hit && hit.blockId !== 4) {
      this.world.setBlock(hit.position, 0);
      if (this.breakCallback) {
        this.breakCallback(hit.position);
      }
    }
  }
  
  private handlePlaceBlock(): void {
    const hit = this.player.raycast();
    if (hit) {
      const item = this.player.getHotbarItem();
      if (item.itemId > 0 && item.count > 0) {
        const placePos = hit.adjacent;
        
        const playerPos = this.player.getState().position;
        const playerMinY = Math.floor(playerPos.y - 1.8);
        const playerMaxY = Math.floor(playerPos.y);
        const playerX = Math.floor(playerPos.x);
        const playerZ = Math.floor(playerPos.z);
        
        const isPlayerCollision = 
          placePos.x === playerX && 
          placePos.z === playerZ && 
          placePos.y >= playerMinY && 
          placePos.y <= playerMaxY;
        
        if (!isPlayerCollision) {
          this.world.setBlock(placePos, item.itemId);
          if (this.placeCallback) {
            this.placeCallback(placePos, item.itemId);
          }
        }
      }
    }
  }
  
  onBreakBlock(callback: (pos: any) => void): void {
    this.breakCallback = callback;
  }
  
  onPlaceBlock(callback: (pos: any, blockId: number) => void): void {
    this.placeCallback = callback;
  }
  
  isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }
  
  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.has(button);
  }
}