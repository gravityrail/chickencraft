import {
  Scene,
  Vector3,
  TransformNode,
  WebXRDefaultExperience,
  WebXRInputSource,
  Color3
} from '@babylonjs/core';
import {
  GUI3DManager,
  HolographicButton,
  NearMenu,
  TouchHolographicButton,
  Container3D,
  StackPanel3D,
  Button3D,
  TextBlock
} from '@babylonjs/gui';

export class XRGui {
  private scene: Scene;
  private manager: GUI3DManager;
  private nearMenu?: NearMenu;
  private menuAnchor?: TransformNode;
  private xrHelper?: WebXRDefaultExperience;
  
  // Callbacks
  private onWorldChange?: (worldType: string) => void;
  private onToolChange?: (toolIndex: number) => void;
  private onChickenToggle?: () => void;
  private onVillagerToggle?: () => void;
  private onTextureToggle?: () => void;
  
  constructor(scene: Scene) {
    this.scene = scene;
    this.manager = new GUI3DManager(scene);
  }
  
  async initialize(xrHelper: WebXRDefaultExperience): Promise<void> {
    this.xrHelper = xrHelper;
    
    // Wait for XR to be initialized
    if (!xrHelper.baseExperience) {
      console.error('XR not initialized');
      return;
    }
    
    // Create menu anchor that follows the left hand
    this.menuAnchor = new TransformNode('menuAnchor', this.scene);
    
    // Create near menu for hand tracking
    this.createNearMenu();
    
    // Setup controller tracking
    xrHelper.input.onControllerAddedObservable.add((controller) => {
      if (controller.inputSource.handedness === 'left') {
        this.attachMenuToController(controller);
      }
    });
  }
  
  private createNearMenu(): void {
    // Create a panel for the menu
    const panel = new StackPanel3D(true);
    this.manager.addControl(panel);
    panel.margin = 0.02;
    
    // Position relative to anchor
    if (this.menuAnchor) {
      panel.position = new Vector3(0, 0.1, 0.2);
      panel.parent = this.menuAnchor;
    }
    
    // World selection buttons
    this.addSectionTitle(panel, "World Type");
    
    const worldTypes = ['default', 'desert', 'island', 'mountains', 'village'];
    worldTypes.forEach(world => {
      const button = new HolographicButton(`world_${world}`);
      panel.addControl(button);
      button.text = world.charAt(0).toUpperCase() + world.slice(1);
      button.onPointerClickObservable.add(() => {
        if (this.onWorldChange) {
          this.onWorldChange(world);
        }
      });
    });
    
    // Tool selection
    this.addSectionTitle(panel, "Tools");
    
    const tools = ['Fist', 'Pickaxe', 'Axe', 'Sword'];
    tools.forEach((tool, index) => {
      const button = new HolographicButton(`tool_${tool}`);
      panel.addControl(button);
      button.text = tool;
      button.onPointerClickObservable.add(() => {
        if (this.onToolChange) {
          this.onToolChange(index);
        }
      });
    });
    
    // Feature toggles
    this.addSectionTitle(panel, "Features");
    
    // Chickens toggle
    const chickenButton = new HolographicButton('toggle_chickens');
    panel.addControl(chickenButton);
    chickenButton.text = "Toggle Chickens";
    chickenButton.onPointerClickObservable.add(() => {
      if (this.onChickenToggle) {
        this.onChickenToggle();
      }
    });
    
    // Villagers toggle
    const villagerButton = new HolographicButton('toggle_villagers');
    panel.addControl(villagerButton);
    villagerButton.text = "Toggle Villagers";
    villagerButton.onPointerClickObservable.add(() => {
      if (this.onVillagerToggle) {
        this.onVillagerToggle();
      }
    });
    
    // Textures toggle
    const textureButton = new HolographicButton('toggle_textures');
    panel.addControl(textureButton);
    textureButton.text = "Toggle Textures";
    textureButton.onPointerClickObservable.add(() => {
      if (this.onTextureToggle) {
        this.onTextureToggle();
      }
    });
  }
  
  private addSectionTitle(panel: StackPanel3D, title: string): void {
    const titleButton = new HolographicButton(`title_${title}`);
    panel.addControl(titleButton);
    titleButton.text = `--- ${title} ---`;
    titleButton.isVisible = true;
    titleButton.isPickable = false;
  }
  
  private attachMenuToController(controller: WebXRInputSource): void {
    if (!this.menuAnchor) return;
    
    // Update menu position to follow controller
    this.scene.registerBeforeRender(() => {
      if (controller.grip) {
        this.menuAnchor.position = controller.grip.position.clone();
        this.menuAnchor.rotationQuaternion = controller.grip.rotationQuaternion?.clone() || null;
        
        // Offset the menu slightly above and forward from the controller
        const forward = controller.grip.forward.scale(0.2);
        const up = Vector3.Up().scale(0.1);
        this.menuAnchor.position.addInPlace(forward);
        this.menuAnchor.position.addInPlace(up);
      }
    });
  }
  
  public setCallbacks(callbacks: {
    onWorldChange?: (worldType: string) => void;
    onToolChange?: (toolIndex: number) => void;
    onChickenToggle?: () => void;
    onVillagerToggle?: () => void;
    onTextureToggle?: () => void;
  }): void {
    this.onWorldChange = callbacks.onWorldChange;
    this.onToolChange = callbacks.onToolChange;
    this.onChickenToggle = callbacks.onChickenToggle;
    this.onVillagerToggle = callbacks.onVillagerToggle;
    this.onTextureToggle = callbacks.onTextureToggle;
  }
  
  public setVisible(visible: boolean): void {
    if (this.menuAnchor) {
      this.menuAnchor.setEnabled(visible);
    }
  }
  
  public dispose(): void {
    this.manager.dispose();
    if (this.menuAnchor) {
      this.menuAnchor.dispose();
    }
  }
}