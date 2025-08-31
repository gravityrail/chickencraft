import { 
  WebXRDefaultExperience, 
  WebXRState, 
  WebXRFeatureName,
  Scene,
  UniversalCamera,
  Vector3,
  Ray,
  MeshBuilder,
  StandardMaterial,
  Color3
} from '@babylonjs/core';
import { AdvancedDynamicTexture, Button, Control } from '@babylonjs/gui';

export class VRSupport {
  private xrHelper?: WebXRDefaultExperience;
  private scene: Scene;
  private vrButton?: Button;
  private isInVR: boolean = false;
  private onMineCallback?: (position: Vector3) => void;
  private onPlaceCallback?: (position: Vector3) => void;
  
  constructor(scene: Scene, _camera: UniversalCamera) {
    this.scene = scene;
  }
  
  async initialize(): Promise<void> {
    try {
      // Check if WebXR is supported
      const xrSupported = 'xr' in navigator;
      
      if (!xrSupported) {
        console.log('WebXR not supported on this device');
        return;
      }
      
      // Check if VR is available
      const vrSupported = await navigator.xr?.isSessionSupported('immersive-vr');
      
      if (!vrSupported) {
        console.log('VR not supported on this device');
        return;
      }
      
      // Create WebXR experience
      this.xrHelper = await WebXRDefaultExperience.CreateAsync(this.scene, {
        uiOptions: {
          sessionMode: 'immersive-vr',
          referenceSpaceType: 'local-floor',
          onError: (error) => {
            console.error('WebXR error:', error);
          }
        },
        inputOptions: {
          doNotLoadControllerMeshes: false,
          forceInputProfile: 'oculus-touch-v3'
        },
        optionalFeatures: true
      });
      
      // Customize the VR button
      const customButton = this.xrHelper.enterExitUI?.overlay;
      if (customButton) {
        customButton.style.position = 'absolute';
        customButton.style.bottom = '20px';
        customButton.style.right = '20px';
        customButton.style.zIndex = '1000';
      }
      
      // Setup VR state change handling
      this.xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        switch (state) {
          case WebXRState.ENTERING_XR:
            console.log('Entering VR...');
            this.onEnterVR();
            break;
          case WebXRState.IN_XR:
            console.log('In VR');
            this.isInVR = true;
            break;
          case WebXRState.EXITING_XR:
            console.log('Exiting VR...');
            this.onExitVR();
            break;
          case WebXRState.NOT_IN_XR:
            console.log('Not in VR');
            this.isInVR = false;
            break;
        }
      });
      
      // Setup controller input
      this.setupControllerInput();
      
      // Configure movement (disable teleportation, we'll use smooth locomotion)
      const featureManager = this.xrHelper.baseExperience.featuresManager;
      
      // Disable teleportation
      featureManager.disableFeature(WebXRFeatureName.TELEPORTATION);
      
      // Disable teleportation and movement features - we'll handle movement manually
      // This prevents the flying issue
      
      // Setup manual movement in the update loop
      this.setupManualMovement();
      
      // Enable pointer selection for UI interaction
      featureManager.enableFeature(WebXRFeatureName.POINTER_SELECTION, 'stable', {
        xrInput: this.xrHelper.input,
        enablePointerSelectionOnAllControllers: true
      });
      
      // Enable hand tracking (optional, for Quest)
      try {
        featureManager.enableFeature(WebXRFeatureName.HAND_TRACKING, 'latest', {
          xrInput: this.xrHelper.input,
          jointMeshes: {
            enablePhysics: false
          }
        });
      } catch (e) {
        console.log('Hand tracking not available');
      }
      
      console.log('VR support initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize VR support:', error);
    }
  }
  
  private setupControllerInput(): void {
    if (!this.xrHelper) return;
    
    // Track which controllers we've already set up
    const setupControllers = new Set<string>();
    
    // Add controller input handling
    this.xrHelper.input.onControllerAddedObservable.add((controller) => {
      // Check if we've already set up this controller
      const controllerId = controller.inputSource.handedness + '_' + controller.inputSource.targetRayMode;
      if (setupControllers.has(controllerId)) {
        return;
      }
      setupControllers.add(controllerId);
      
      console.log('Controller added:', controller.inputSource.handedness);
      
      // Setup trigger for mining (primary action) - use addOnce to prevent duplicates
      controller.onMotionControllerInitObservable.addOnce((motionController) => {
        const triggerComponent = motionController.getComponent('xr-standard-trigger');
        
        if (triggerComponent) {
          triggerComponent.onButtonStateChangedObservable.add(() => {
            if (triggerComponent.pressed) {
              this.handleVRMining(controller);
            }
          });
        }
        
        // Setup grip button for placing blocks
        const gripComponent = motionController.getComponent('xr-standard-squeeze');
        
        if (gripComponent) {
          gripComponent.onButtonStateChangedObservable.add(() => {
            if (gripComponent.pressed) {
              this.handleVRPlacing(controller);
            }
          });
        }
        
        // Setup thumbstick for movement
        const thumbstick = motionController.getComponent('xr-standard-thumbstick');
        
        if (thumbstick) {
          thumbstick.onAxisValueChangedObservable.add((_axes) => {
            // Movement is handled by the WebXR movement feature
            // But we can add custom logic here if needed
          });
        }
        
        // Setup A/B/X/Y buttons for actions
        const aButton = motionController.getComponentOfType('button');
        if (aButton && aButton.id === 'a-button') {
          aButton.onButtonStateChangedObservable.add(() => {
            if (aButton.pressed) {
              // Jump action
              console.log('Jump!');
            }
          });
        }
      });
    });
  }
  
  private handleVRMining(controller: any): void {
    // Cast ray from controller to find block to mine
    const ray = new Ray(
      controller.pointer.position,
      controller.pointer.forward,
      10
    );
    
    // Check for block hit
    const pickInfo = this.scene.pickWithRay(ray);
    
    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
      const blockPos = new Vector3(
        Math.floor(pickInfo.pickedPoint.x),
        Math.floor(pickInfo.pickedPoint.y),
        Math.floor(pickInfo.pickedPoint.z)
      );
      
      // Call mining callback
      if (this.onMineCallback) {
        this.onMineCallback(blockPos);
      }
      
      // Visual feedback
      this.createMiningEffect(pickInfo.pickedPoint);
    }
  }
  
  private handleVRPlacing(controller: any): void {
    // Cast ray from controller to find where to place block
    const ray = new Ray(
      controller.pointer.position,
      controller.pointer.forward,
      10
    );
    
    const pickInfo = this.scene.pickWithRay(ray);
    
    if (pickInfo && pickInfo.hit && pickInfo.pickedPoint && pickInfo.getNormal()) {
      // Calculate position for new block (adjacent to hit face)
      const normal = pickInfo.getNormal(true, true) || new Vector3(0, 1, 0);
      const placePos = pickInfo.pickedPoint.add(normal.scale(0.5));
      const blockPos = new Vector3(
        Math.floor(placePos.x),
        Math.floor(placePos.y),
        Math.floor(placePos.z)
      );
      
      // Call placing callback
      if (this.onPlaceCallback) {
        this.onPlaceCallback(blockPos);
      }
    }
  }
  
  private createMiningEffect(position: Vector3): void {
    // Create a simple particle effect for mining feedback
    const sphere = MeshBuilder.CreateSphere('miningEffect', { diameter: 0.2 }, this.scene);
    sphere.position = position;
    
    const mat = new StandardMaterial('miningEffectMat', this.scene);
    mat.diffuseColor = new Color3(1, 1, 0);
    mat.emissiveColor = new Color3(1, 1, 0);
    sphere.material = mat;
    
    // Animate and destroy
    let scale = 1;
    const animation = setInterval(() => {
      scale *= 0.9;
      sphere.scaling = new Vector3(scale, scale, scale);
      
      if (scale < 0.1) {
        clearInterval(animation);
        // Properly dispose of material and mesh
        if (sphere.material) {
          sphere.material.dispose();
        }
        sphere.dispose();
      }
    }, 50);
  }
  
  private onEnterVR(): void {
    // Hide desktop UI elements
    const crosshair = document.querySelector('.crosshair');
    if (crosshair) {
      (crosshair as HTMLElement).style.display = 'none';
    }
    
    // Adjust scene for VR
    this.scene.fogEnd = 200; // Increase view distance in VR
  }
  
  private onExitVR(): void {
    // Restore desktop UI elements
    const crosshair = document.querySelector('.crosshair');
    if (crosshair) {
      (crosshair as HTMLElement).style.display = 'block';
    }
    
    // Restore scene settings
    this.scene.fogEnd = 100;
  }
  
  public setMiningCallback(callback: (position: Vector3) => void): void {
    this.onMineCallback = callback;
  }
  
  public setPlacingCallback(callback: (position: Vector3) => void): void {
    this.onPlaceCallback = callback;
  }
  
  public createVRButton(advancedTexture: AdvancedDynamicTexture): Button {
    // Create custom VR button in Babylon GUI
    const vrButton = Button.CreateSimpleButton("vrButton", "Enter VR");
    vrButton.width = "120px";
    vrButton.height = "40px";
    vrButton.color = "white";
    vrButton.background = "green";
    vrButton.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    vrButton.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    vrButton.left = "-20px";
    vrButton.top = "-80px";
    
    vrButton.onPointerClickObservable.add(async () => {
      if (this.xrHelper) {
        try {
          await this.xrHelper.baseExperience.enterXRAsync(
            'immersive-vr',
            'local-floor'
          );
        } catch (error) {
          console.error('Failed to enter VR:', error);
        }
      }
    });
    
    advancedTexture.addControl(vrButton);
    this.vrButton = vrButton;
    
    return vrButton;
  }
  
  public get isVRAvailable(): boolean {
    return !!this.xrHelper;
  }
  
  public get isCurrentlyInVR(): boolean {
    return this.isInVR;
  }
  
  private setupManualMovement(): void {
    if (!this.xrHelper) return;
    
    // Track thumbstick values for movement
    let leftStickX = 0;
    let leftStickY = 0;
    let rightStickX = 0;
    let rightStickY = 0;
    
    // Track ground height
    let groundHeight = 0;
    
    this.xrHelper.input.onControllerAddedObservable.add((controller) => {
      controller.onMotionControllerInitObservable.add((motionController) => {
        const thumbstick = motionController.getComponent('xr-standard-thumbstick');
        
        if (thumbstick) {
          thumbstick.onAxisValueChangedObservable.add((axes) => {
            if (controller.inputSource.handedness === 'left') {
              leftStickX = axes.x;
              leftStickY = axes.y;
            } else if (controller.inputSource.handedness === 'right') {
              rightStickX = axes.x;
              rightStickY = axes.y;
            }
          });
        }
      });
    });
    
    // Update movement in render loop
    this.scene.registerBeforeRender(() => {
      if (!this.xrHelper?.baseExperience?.camera) return;
      
      const camera = this.xrHelper.baseExperience.camera;
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      
      // Get forward direction from camera rotation
      // Note: In VR, we need to use negative Z for forward (Babylon convention)
      const forward = new Vector3(
        Math.sin(camera.rotation.y),
        0,
        Math.cos(camera.rotation.y)
      );
      
      // Get right direction
      const right = new Vector3(
        Math.cos(camera.rotation.y),
        0,
        -Math.sin(camera.rotation.y)
      );
      
      // Apply movement based on right thumbstick
      // Note: Negate Y input because thumbstick up is negative
      const moveSpeed = 4; // meters per second
      const movement = forward.scale(-rightStickY * moveSpeed * dt)
        .add(right.scale(rightStickX * moveSpeed * dt));
      
      // Apply rotation based on left thumbstick
      const rotSpeed = 1.5; // radians per second
      camera.rotation.y += leftStickX * rotSpeed * dt;
      
      // Apply movement to camera position
      camera.position.addInPlace(movement);
      
      // Cast ray down from camera to find ground
      const rayOrigin = camera.position.clone();
      rayOrigin.y += 10; // Start from above
      const ray = new Ray(rayOrigin, Vector3.Down(), 20);
      const pickInfo = this.scene.pickWithRay(ray, (mesh) => {
        // Only pick solid blocks, not entities or UI
        return mesh.name.startsWith('chunk_') || mesh.name === 'ground';
      });
      
      if (pickInfo && pickInfo.hit && pickInfo.pickedPoint) {
        // Place camera 1.6 blocks above the ground (player height)
        groundHeight = pickInfo.pickedPoint.y + 1.6;
        
        // Smoothly adjust to ground height
        const heightDiff = groundHeight - camera.position.y;
        if (Math.abs(heightDiff) > 0.01) {
          camera.position.y += heightDiff * 0.1; // Smooth transition
        }
      }
    });
  }
  
  public dispose(): void {
    if (this.xrHelper) {
      this.xrHelper.dispose();
    }
    
    if (this.vrButton) {
      this.vrButton.dispose();
    }
  }
}