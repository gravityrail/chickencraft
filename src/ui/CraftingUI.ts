import { 
  AdvancedDynamicTexture, 
  Rectangle, 
  Image, 
  TextBlock, 
  Control,
  Grid,
  Button
} from '@babylonjs/gui';
import { Scene } from '@babylonjs/core';
import { CraftingSystem } from '../crafting/CraftingSystem';
import { BlockId } from '../world/Block';

export class CraftingUI {
  private scene: Scene;
  private advancedTexture: AdvancedDynamicTexture;
  private craftingSystem: CraftingSystem;
  private isVisible: boolean = false;
  
  // UI Elements
  private container?: Rectangle;
  private craftingGrid: (BlockId | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null]
  ];
  private gridButtons: Button[][] = [];
  private outputSlot?: Rectangle;
  private outputIcon?: Image;
  private outputText?: TextBlock;
  
  // Current selection
  private selectedBlock: BlockId = BlockId.WOOD;
  
  constructor(scene: Scene, advancedTexture: AdvancedDynamicTexture) {
    this.scene = scene;
    this.advancedTexture = advancedTexture;
    this.craftingSystem = new CraftingSystem();
    this.createUI();
  }
  
  private createUI(): void {
    // Main container
    this.container = new Rectangle('craftingContainer');
    this.container.width = '400px';
    this.container.height = '500px';
    this.container.background = 'rgba(0, 0, 0, 0.8)';
    this.container.thickness = 2;
    this.container.color = 'white';
    this.container.cornerRadius = 10;
    this.container.isVisible = false;
    this.advancedTexture.addControl(this.container);
    
    // Title
    const title = new TextBlock('craftingTitle', 'Crafting Table');
    title.color = 'white';
    title.fontSize = 24;
    title.height = '30px';
    title.top = '-220px';
    this.container.addControl(title);
    
    // Create 3x3 grid for crafting
    const gridContainer = new Grid('craftingGrid');
    gridContainer.width = '200px';
    gridContainer.height = '200px';
    gridContainer.top = '-50px';
    
    // Add rows and columns
    for (let i = 0; i < 3; i++) {
      gridContainer.addRowDefinition(1/3);
      gridContainer.addColumnDefinition(1/3);
    }
    
    this.container.addControl(gridContainer);
    
    // Create grid slots
    for (let row = 0; row < 3; row++) {
      this.gridButtons[row] = [];
      for (let col = 0; col < 3; col++) {
        const slot = Button.CreateSimpleButton(`slot_${row}_${col}`, '');
        slot.width = '60px';
        slot.height = '60px';
        slot.background = 'rgba(100, 100, 100, 0.5)';
        slot.thickness = 1;
        slot.color = 'gray';
        
        // Store row/col in the button for click handling
        (slot as any).gridRow = row;
        (slot as any).gridCol = col;
        
        slot.onPointerClickObservable.add(() => {
          this.onSlotClick(row, col);
        });
        
        gridContainer.addControl(slot, row, col);
        this.gridButtons[row][col] = slot;
      }
    }
    
    // Arrow pointing to output
    const arrow = new TextBlock('arrow', '→');
    arrow.color = 'white';
    arrow.fontSize = 36;
    arrow.width = '50px';
    arrow.height = '50px';
    arrow.left = '100px';
    arrow.top = '-50px';
    this.container.addControl(arrow);
    
    // Output slot
    this.outputSlot = new Rectangle('outputSlot');
    this.outputSlot.width = '80px';
    this.outputSlot.height = '80px';
    this.outputSlot.background = 'rgba(50, 150, 50, 0.5)';
    this.outputSlot.thickness = 2;
    this.outputSlot.color = 'lightgreen';
    this.outputSlot.left = '150px';
    this.outputSlot.top = '-50px';
    this.container.addControl(this.outputSlot);
    
    // Output text (shows what will be crafted)
    this.outputText = new TextBlock('outputText', '');
    this.outputText.color = 'white';
    this.outputText.fontSize = 14;
    this.outputText.top = '35px';
    this.outputSlot.addControl(this.outputText);
    
    // Block selector at bottom
    const blockSelector = new Rectangle('blockSelector');
    blockSelector.width = '350px';
    blockSelector.height = '80px';
    blockSelector.background = 'rgba(50, 50, 50, 0.5)';
    blockSelector.thickness = 1;
    blockSelector.color = 'gray';
    blockSelector.top = '150px';
    this.container.addControl(blockSelector);
    
    // Add available blocks
    const blocks = [BlockId.WOOD, BlockId.BRICK, BlockId.GRASS];
    const blockNames = ['Wood', 'Brick', 'Grass'];
    const blockGrid = new Grid('blockGrid');
    blockGrid.width = '340px';
    blockGrid.height = '70px';
    
    blockGrid.addRowDefinition(1);
    blocks.forEach(() => blockGrid.addColumnDefinition(1/blocks.length));
    
    blockSelector.addControl(blockGrid);
    
    blocks.forEach((blockId, index) => {
      const blockButton = Button.CreateSimpleButton(`block_${blockId}`, blockNames[index]);
      blockButton.width = '100px';
      blockButton.height = '60px';
      blockButton.background = this.selectedBlock === blockId ? 'rgba(100, 200, 100, 0.5)' : 'rgba(100, 100, 100, 0.5)';
      blockButton.thickness = 1;
      blockButton.color = 'white';
      blockButton.fontSize = 14;
      
      blockButton.onPointerClickObservable.add(() => {
        this.selectedBlock = blockId;
        this.updateBlockSelector(blocks, blockNames, blockGrid);
      });
      
      blockGrid.addControl(blockButton, 0, index);
    });
    
    // Clear button
    const clearButton = Button.CreateSimpleButton('clearButton', 'Clear Grid');
    clearButton.width = '100px';
    clearButton.height = '30px';
    clearButton.background = 'rgba(200, 50, 50, 0.5)';
    clearButton.color = 'white';
    clearButton.fontSize = 14;
    clearButton.top = '200px';
    clearButton.onPointerClickObservable.add(() => {
      this.clearGrid();
    });
    this.container.addControl(clearButton);
    
    // Instructions
    const instructions = new TextBlock('instructions', 'Click slots to place blocks. Press K to close.');
    instructions.color = 'lightgray';
    instructions.fontSize = 12;
    instructions.top = '230px';
    this.container.addControl(instructions);
  }
  
  private updateBlockSelector(blocks: BlockId[], blockNames: string[], blockGrid: Grid): void {
    // Update block selector buttons
    blocks.forEach((blockId, index) => {
      const button = blockGrid.children[index] as Button;
      button.background = this.selectedBlock === blockId ? 'rgba(100, 200, 100, 0.5)' : 'rgba(100, 100, 100, 0.5)';
    });
  }
  
  private onSlotClick(row: number, col: number): void {
    // Toggle block in slot
    if (this.craftingGrid[row][col] === this.selectedBlock) {
      this.craftingGrid[row][col] = null;
    } else {
      this.craftingGrid[row][col] = this.selectedBlock;
    }
    
    this.updateGridDisplay();
    this.checkRecipe();
  }
  
  private updateGridDisplay(): void {
    // Update visual representation of grid
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const button = this.gridButtons[row][col];
        const blockId = this.craftingGrid[row][col];
        
        if (blockId === null) {
          button.textBlock!.text = '';
          button.background = 'rgba(100, 100, 100, 0.5)';
        } else {
          button.textBlock!.text = this.getBlockSymbol(blockId);
          button.background = 'rgba(150, 150, 150, 0.7)';
        }
      }
    }
  }
  
  private getBlockSymbol(blockId: BlockId): string {
    switch (blockId) {
      case BlockId.WOOD: return '🪵';
      case BlockId.BRICK: return '🧱';
      case BlockId.GRASS: return '🌿';
      default: return '?';
    }
  }
  
  private checkRecipe(): void {
    // Check if current grid matches any recipe
    const recipe = this.craftingSystem.checkRecipe(this.craftingGrid);
    
    if (recipe && recipe.output.type === 'tool') {
      this.outputText!.text = `${recipe.output.toolType}\n(${recipe.output.material})`;
      this.outputSlot!.background = 'rgba(50, 200, 50, 0.7)';
    } else {
      this.outputText!.text = '';
      this.outputSlot!.background = 'rgba(50, 150, 50, 0.5)';
    }
  }
  
  private clearGrid(): void {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        this.craftingGrid[row][col] = null;
      }
    }
    this.updateGridDisplay();
    this.checkRecipe();
  }
  
  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.isVisible = this.isVisible;
    }
  }
  
  public show(): void {
    this.isVisible = true;
    if (this.container) {
      this.container.isVisible = true;
    }
  }
  
  public hide(): void {
    this.isVisible = false;
    if (this.container) {
      this.container.isVisible = false;
    }
  }
  
  public getIsVisible(): boolean {
    return this.isVisible;
  }
}