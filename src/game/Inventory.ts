import { InventorySlot } from '../types';
import { BlockRegistry } from '../world/Block';

export class Inventory {
  private slots: InventorySlot[];
  private size: number;
  
  constructor(size: number = 36) {
    this.size = size;
    this.slots = new Array(size).fill(null).map(() => ({ itemId: 0, count: 0 }));
  }
  
  getSlot(index: number): InventorySlot | null {
    if (index < 0 || index >= this.size) return null;
    return this.slots[index];
  }
  
  setSlot(index: number, slot: InventorySlot): boolean {
    if (index < 0 || index >= this.size) return false;
    this.slots[index] = { ...slot };
    return true;
  }
  
  addItem(itemId: number, count: number): number {
    if (count <= 0) return 0;
    
    const maxStackSize = this.getMaxStackSize(itemId);
    let remaining = count;
    
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const slot = this.slots[i];
      
      if (slot.itemId === itemId && slot.count < maxStackSize) {
        const space = maxStackSize - slot.count;
        const toAdd = Math.min(space, remaining);
        slot.count += toAdd;
        remaining -= toAdd;
      }
    }
    
    for (let i = 0; i < this.size && remaining > 0; i++) {
      const slot = this.slots[i];
      
      if (slot.itemId === 0) {
        const toAdd = Math.min(maxStackSize, remaining);
        slot.itemId = itemId;
        slot.count = toAdd;
        remaining -= toAdd;
      }
    }
    
    return count - remaining;
  }
  
  removeItem(itemId: number, count: number): number {
    if (count <= 0) return 0;
    
    let remaining = count;
    
    for (let i = this.size - 1; i >= 0 && remaining > 0; i--) {
      const slot = this.slots[i];
      
      if (slot.itemId === itemId) {
        const toRemove = Math.min(slot.count, remaining);
        slot.count -= toRemove;
        remaining -= toRemove;
        
        if (slot.count === 0) {
          slot.itemId = 0;
        }
      }
    }
    
    return count - remaining;
  }
  
  hasItem(itemId: number, count: number): boolean {
    let total = 0;
    
    for (const slot of this.slots) {
      if (slot.itemId === itemId) {
        total += slot.count;
        if (total >= count) return true;
      }
    }
    
    return false;
  }
  
  countItem(itemId: number): number {
    let total = 0;
    
    for (const slot of this.slots) {
      if (slot.itemId === itemId) {
        total += slot.count;
      }
    }
    
    return total;
  }
  
  findFirstSlot(itemId: number): number {
    for (let i = 0; i < this.size; i++) {
      if (this.slots[i].itemId === itemId) {
        return i;
      }
    }
    return -1;
  }
  
  findEmptySlot(): number {
    for (let i = 0; i < this.size; i++) {
      if (this.slots[i].itemId === 0) {
        return i;
      }
    }
    return -1;
  }
  
  swapSlots(index1: number, index2: number): boolean {
    if (index1 < 0 || index1 >= this.size || index2 < 0 || index2 >= this.size) {
      return false;
    }
    
    const temp = this.slots[index1];
    this.slots[index1] = this.slots[index2];
    this.slots[index2] = temp;
    return true;
  }
  
  transferSlot(fromIndex: number, toInventory: Inventory, toIndex: number): boolean {
    const fromSlot = this.getSlot(fromIndex);
    const toSlot = toInventory.getSlot(toIndex);
    
    if (!fromSlot || !toSlot) return false;
    
    if (toSlot.itemId === 0) {
      toInventory.setSlot(toIndex, { ...fromSlot });
      this.setSlot(fromIndex, { itemId: 0, count: 0 });
      return true;
    } else if (toSlot.itemId === fromSlot.itemId) {
      const maxStack = this.getMaxStackSize(toSlot.itemId);
      const space = maxStack - toSlot.count;
      const transfer = Math.min(space, fromSlot.count);
      
      if (transfer > 0) {
        toSlot.count += transfer;
        fromSlot.count -= transfer;
        
        if (fromSlot.count === 0) {
          this.setSlot(fromIndex, { itemId: 0, count: 0 });
        }
        
        return true;
      }
    }
    
    return false;
  }
  
  clear(): void {
    for (let i = 0; i < this.size; i++) {
      this.slots[i] = { itemId: 0, count: 0 };
    }
  }
  
  getHotbarSlots(): InventorySlot[] {
    return this.slots.slice(0, 9);
  }
  
  getMainSlots(): InventorySlot[] {
    return this.slots.slice(9);
  }
  
  getAllSlots(): InventorySlot[] {
    return [...this.slots];
  }
  
  serialize(): string {
    return JSON.stringify(this.slots);
  }
  
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length === this.size) {
        this.slots = parsed.map(slot => ({
          itemId: slot.itemId || 0,
          count: slot.count || 0
        }));
      }
    } catch (e) {
      console.error('Failed to deserialize inventory:', e);
    }
  }
  
  private getMaxStackSize(itemId: number): number {
    const block = BlockRegistry.getBlock(itemId);
    if (block && block.name === 'Bedrock') return 1;
    return 64;
  }
}