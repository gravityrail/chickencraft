import { describe, it, expect, beforeEach } from 'vitest';
import { Inventory } from '../game/Inventory';
import { BlockId } from '../world/Block';

describe('Inventory', () => {
  let inventory: Inventory;
  
  beforeEach(() => {
    inventory = new Inventory(36);
  });
  
  describe('constructor', () => {
    it('should create inventory with specified size', () => {
      const inv = new Inventory(10);
      expect(inv.getAllSlots().length).toBe(10);
    });
    
    it('should initialize all slots as empty', () => {
      const slots = inventory.getAllSlots();
      slots.forEach(slot => {
        expect(slot.itemId).toBe(0);
        expect(slot.count).toBe(0);
      });
    });
  });
  
  describe('addItem', () => {
    it('should add items to empty slots', () => {
      const added = inventory.addItem(BlockId.GRASS, 10);
      expect(added).toBe(10);
      expect(inventory.countItem(BlockId.GRASS)).toBe(10);
    });
    
    it('should stack items in existing slots', () => {
      inventory.addItem(BlockId.GRASS, 10);
      inventory.addItem(BlockId.GRASS, 20);
      expect(inventory.countItem(BlockId.GRASS)).toBe(30);
    });
    
    it('should respect max stack size', () => {
      inventory.addItem(BlockId.GRASS, 100);
      const firstSlot = inventory.getSlot(0);
      expect(firstSlot?.count).toBe(64);
      const secondSlot = inventory.getSlot(1);
      expect(secondSlot?.count).toBe(36);
    });
    
    it('should return amount added when inventory is full', () => {
      for (let i = 0; i < 36; i++) {
        inventory.setSlot(i, { itemId: BlockId.WOOD, count: 64 });
      }
      const added = inventory.addItem(BlockId.GRASS, 10);
      expect(added).toBe(0);
    });
  });
  
  describe('removeItem', () => {
    beforeEach(() => {
      inventory.addItem(BlockId.GRASS, 100);
    });
    
    it('should remove items from inventory', () => {
      const removed = inventory.removeItem(BlockId.GRASS, 30);
      expect(removed).toBe(30);
      expect(inventory.countItem(BlockId.GRASS)).toBe(70);
    });
    
    it('should remove from multiple stacks', () => {
      const removed = inventory.removeItem(BlockId.GRASS, 80);
      expect(removed).toBe(80);
      expect(inventory.countItem(BlockId.GRASS)).toBe(20);
    });
    
    it('should return amount actually removed', () => {
      const removed = inventory.removeItem(BlockId.GRASS, 150);
      expect(removed).toBe(100);
      expect(inventory.countItem(BlockId.GRASS)).toBe(0);
    });
    
    it('should clear slots when count reaches zero', () => {
      inventory.removeItem(BlockId.GRASS, 100);
      const slot = inventory.getSlot(0);
      expect(slot?.itemId).toBe(0);
      expect(slot?.count).toBe(0);
    });
  });
  
  describe('hasItem', () => {
    it('should return true when item exists in sufficient quantity', () => {
      inventory.addItem(BlockId.GRASS, 50);
      expect(inventory.hasItem(BlockId.GRASS, 30)).toBe(true);
      expect(inventory.hasItem(BlockId.GRASS, 50)).toBe(true);
    });
    
    it('should return false when item quantity is insufficient', () => {
      inventory.addItem(BlockId.GRASS, 30);
      expect(inventory.hasItem(BlockId.GRASS, 50)).toBe(false);
    });
    
    it('should return false for items not in inventory', () => {
      expect(inventory.hasItem(BlockId.WOOD, 1)).toBe(false);
    });
  });
  
  describe('swapSlots', () => {
    it('should swap two slots', () => {
      inventory.setSlot(0, { itemId: BlockId.GRASS, count: 10 });
      inventory.setSlot(1, { itemId: BlockId.WOOD, count: 20 });
      
      inventory.swapSlots(0, 1);
      
      expect(inventory.getSlot(0)).toEqual({ itemId: BlockId.WOOD, count: 20 });
      expect(inventory.getSlot(1)).toEqual({ itemId: BlockId.GRASS, count: 10 });
    });
    
    it('should return false for invalid indices', () => {
      expect(inventory.swapSlots(-1, 0)).toBe(false);
      expect(inventory.swapSlots(0, 100)).toBe(false);
    });
  });
  
  describe('hotbar and main slots', () => {
    it('should return first 9 slots as hotbar', () => {
      const hotbar = inventory.getHotbarSlots();
      expect(hotbar.length).toBe(9);
    });
    
    it('should return remaining slots as main inventory', () => {
      const main = inventory.getMainSlots();
      expect(main.length).toBe(27);
    });
  });
  
  describe('serialization', () => {
    it('should serialize and deserialize inventory', () => {
      inventory.addItem(BlockId.GRASS, 50);
      inventory.addItem(BlockId.WOOD, 30);
      inventory.addItem(BlockId.BRICK, 10);
      
      const serialized = inventory.serialize();
      
      const newInv = new Inventory(36);
      newInv.deserialize(serialized);
      
      expect(newInv.countItem(BlockId.GRASS)).toBe(50);
      expect(newInv.countItem(BlockId.WOOD)).toBe(30);
      expect(newInv.countItem(BlockId.BRICK)).toBe(10);
    });
  });
});