import { Vector3, UniversalCamera, Scene } from '@babylonjs/core';
import { PlayerState, RaycastHit, InventorySlot } from '../types';
import { World, SEA_LEVEL } from '../world/World';
import { BlockRegistry } from '../world/Block';

export class Player {
  private camera: UniversalCamera;
  private world: World;
  private state: PlayerState;
  private velocity: Vector3 = Vector3.Zero();
  private isGrounded: boolean = false;
  private isInWater: boolean = false;
  private jumpVelocity: number = 5;
  private walkSpeed: number = 4.3;
  private sprintSpeed: number = 6.0;
  private isSprinting: boolean = false;
  private gravity: number = -20;
  private playerHeight: number = 1.8;
  private playerWidth: number = 0.6;
  private lastDamageTime: number = 0;
  
  constructor(scene: Scene, world: World) {
    this.world = world;
    
    this.camera = new UniversalCamera('playerCamera', new Vector3(512, 10, 512), scene);
    this.camera.setTarget(new Vector3(512, 10, 513));
    this.camera.attachControl();
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.fov = Math.PI / 180 * 75;
    this.camera.speed = 0;
    this.camera.inertia = 0;
    this.camera.angularSensibility = 1000;
    
    this.state = {
      position: { x: 512, y: 10, z: 512 },
      rotation: { x: 0, y: 0, z: 0 },
      health: 20,
      maxHealth: 20,
      breath: 10,
      maxBreath: 10,
      inventory: this.createInitialInventory(),
      hotbarIndex: 0
    };
  }
  
  private createInitialInventory(): InventorySlot[] {
    const inventory: InventorySlot[] = [];
    for (let i = 0; i < 36; i++) {
      inventory.push({ itemId: 0, count: 0 });
    }
    inventory[0] = { itemId: 1, count: 64 };
    inventory[1] = { itemId: 2, count: 64 };
    inventory[2] = { itemId: 3, count: 64 };
    inventory[3] = { itemId: 6, count: 64 };
    
    return inventory;
  }
  
  update(deltaTime: number): void {
    this.updateMovement(deltaTime);
    this.checkEnvironment();
    this.updateHealth(deltaTime);
    this.syncCameraPosition();
  }
  
  private updateMovement(deltaTime: number): void {
    
    if (!this.isGrounded) {
      this.velocity.y += this.gravity * deltaTime;
    } else {
      this.velocity.y = 0;
    }
    
    if (this.isInWater) {
      this.velocity.y *= 0.98;
      if (this.velocity.y < -2) {
        this.velocity.y = -2;
      }
    }
    
    const newPos = this.camera.position.add(this.velocity.scale(deltaTime));
    
    if (!this.checkCollision(newPos)) {
      this.camera.position = newPos;
      this.state.position = {
        x: newPos.x,
        y: newPos.y,
        z: newPos.z
      };
    } else {
      if (!this.checkCollision(new Vector3(newPos.x, this.camera.position.y, this.camera.position.z))) {
        this.camera.position.x = newPos.x;
      }
      if (!this.checkCollision(new Vector3(this.camera.position.x, newPos.y, this.camera.position.z))) {
        this.camera.position.y = newPos.y;
      } else {
        this.velocity.y = 0;
        this.isGrounded = true;
      }
      if (!this.checkCollision(new Vector3(this.camera.position.x, this.camera.position.y, newPos.z))) {
        this.camera.position.z = newPos.z;
      }
    }
  }
  
  private checkCollision(position: Vector3): boolean {
    const minX = Math.floor(position.x - this.playerWidth / 2);
    const maxX = Math.floor(position.x + this.playerWidth / 2);
    const minY = Math.floor(position.y - this.playerHeight);
    const maxY = Math.floor(position.y);
    const minZ = Math.floor(position.z - this.playerWidth / 2);
    const maxZ = Math.floor(position.z + this.playerWidth / 2);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolid({ x, y, z })) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  private checkEnvironment(): void {
    const feetPos = this.camera.position.subtract(new Vector3(0, this.playerHeight, 0));
    const groundPos = feetPos.subtract(new Vector3(0, 0.1, 0));
    
    this.isGrounded = this.world.isSolid({
      x: Math.floor(groundPos.x),
      y: Math.floor(groundPos.y),
      z: Math.floor(groundPos.z)
    });
    
    this.isInWater = this.camera.position.y < SEA_LEVEL;
    
    const blockAtHead = this.world.getBlock({
      x: Math.floor(this.camera.position.x),
      y: Math.floor(this.camera.position.y),
      z: Math.floor(this.camera.position.z)
    });
    
    const blockDef = BlockRegistry.getBlock(blockAtHead);
    if (blockDef && blockDef.damage) {
      const now = Date.now();
      if (now - this.lastDamageTime > 1000) {
        this.takeDamage(blockDef.damage);
        this.lastDamageTime = now;
      }
    }
  }
  
  private updateHealth(deltaTime: number): void {
    if (this.isInWater && this.camera.position.y < SEA_LEVEL - 1) {
      this.state.breath -= deltaTime;
      if (this.state.breath < 0) {
        this.state.breath = 0;
        if (Date.now() - this.lastDamageTime > 2000) {
          this.takeDamage(1);
          this.lastDamageTime = Date.now();
        }
      }
    } else {
      this.state.breath = Math.min(this.state.breath + deltaTime * 2, this.state.maxBreath);
    }
  }
  
  private syncCameraPosition(): void {
    this.state.position = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z
    };
    
    this.state.rotation = {
      x: this.camera.rotation.x,
      y: this.camera.rotation.y,
      z: this.camera.rotation.z
    };
  }
  
  jump(): void {
    if (this.isGrounded || this.isInWater) {
      this.velocity.y = this.jumpVelocity;
      this.isGrounded = false;
    }
  }
  
  setSprinting(sprinting: boolean): void {
    this.isSprinting = sprinting;
  }
  
  moveForward(): void {
    const forward = this.camera.getForwardRay().direction;
    forward.y = 0;
    forward.normalize();
    const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    this.velocity.x = forward.x * speed;
    this.velocity.z = forward.z * speed;
  }
  
  moveBackward(): void {
    const forward = this.camera.getForwardRay().direction;
    forward.y = 0;
    forward.normalize();
    const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    this.velocity.x = -forward.x * speed;
    this.velocity.z = -forward.z * speed;
  }
  
  moveLeft(): void {
    const right = this.camera.getForwardRay().direction.cross(Vector3.Up());
    right.normalize();
    const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    this.velocity.x = -right.x * speed;
    this.velocity.z = -right.z * speed;
  }
  
  moveRight(): void {
    const right = this.camera.getForwardRay().direction.cross(Vector3.Up());
    right.normalize();
    const speed = this.isSprinting ? this.sprintSpeed : this.walkSpeed;
    this.velocity.x = right.x * speed;
    this.velocity.z = right.z * speed;
  }
  
  stopMoving(): void {
    this.velocity.x = 0;
    this.velocity.z = 0;
  }
  
  takeDamage(amount: number): void {
    this.state.health = Math.max(0, this.state.health - amount);
    if (this.state.health <= 0) {
      this.respawn();
    }
  }
  
  heal(amount: number): void {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount);
  }
  
  respawn(): void {
    this.camera.position = new Vector3(512, 10, 512);
    this.state.health = this.state.maxHealth;
    this.state.breath = this.state.maxBreath;
    this.velocity = Vector3.Zero();
  }
  
  raycast(maxDistance: number = 5): RaycastHit | null {
    const ray = this.camera.getForwardRay(maxDistance);
    const step = 0.1;
    
    for (let t = 0; t < maxDistance; t += step) {
      const point = ray.origin.add(ray.direction.scale(t));
      const blockPos = {
        x: Math.floor(point.x),
        y: Math.floor(point.y),
        z: Math.floor(point.z)
      };
      
      const blockId = this.world.getBlock(blockPos);
      if (BlockRegistry.isSolid(blockId)) {
        const prevPoint = ray.origin.add(ray.direction.scale(Math.max(0, t - step)));
        const adjacentPos = {
          x: Math.floor(prevPoint.x),
          y: Math.floor(prevPoint.y),
          z: Math.floor(prevPoint.z)
        };
        
        const dx = blockPos.x - adjacentPos.x;
        const dy = blockPos.y - adjacentPos.y;
        const dz = blockPos.z - adjacentPos.z;
        
        return {
          blockId,
          position: blockPos,
          normal: { x: -dx, y: -dy, z: -dz },
          adjacent: adjacentPos,
          distance: t
        };
      }
    }
    
    return null;
  }
  
  getCamera(): UniversalCamera {
    return this.camera;
  }
  
  getState(): PlayerState {
    return this.state;
  }
  
  getHotbarItem(): InventorySlot {
    return this.state.inventory[this.state.hotbarIndex];
  }
  
  setHotbarIndex(index: number): void {
    this.state.hotbarIndex = Math.max(0, Math.min(8, index));
  }
}