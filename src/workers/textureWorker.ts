// Web Worker for generating textures asynchronously
self.onmessage = function(e) {
  const { type, size } = e.data;
  
  // Create offscreen canvas for texture generation
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  
  if (!context) {
    self.postMessage({ error: 'Could not get 2D context' });
    return;
  }
  
  switch(type) {
    case 'grass':
      generateGrassTexture(context, size);
      break;
    case 'dirt':
      generateDirtTexture(context, size);
      break;
    case 'rock':
      generateRockTexture(context, size);
      break;
    default:
      self.postMessage({ error: 'Unknown texture type' });
      return;
  }
  
  // Convert canvas to blob and send back
  canvas.convertToBlob().then(blob => {
    self.postMessage({ 
      type, 
      blob,
      progress: 100
    });
  });
};

function generateGrassTexture(context: OffscreenCanvasRenderingContext2D, size: number) {
  // Base green color
  context.fillStyle = '#4a7c59';
  context.fillRect(0, 0, size, size);
  
  // Report progress
  self.postMessage({ type: 'grass', progress: 50 });
  
  // Add grass variations
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const brightness = 80 + Math.random() * 40;
    context.fillStyle = `rgb(${Math.floor(brightness * 0.4)}, ${Math.floor(brightness)}, ${Math.floor(brightness * 0.3)})`;
    context.fillRect(x, y, 3, 3);
  }
}

function generateDirtTexture(context: OffscreenCanvasRenderingContext2D, size: number) {
  // Base brown color
  context.fillStyle = '#8b6239';
  context.fillRect(0, 0, size, size);
  
  // Report progress
  self.postMessage({ type: 'dirt', progress: 50 });
  
  // Add dirt spots
  for (let i = 0; i < 25; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const variation = Math.random() * 30 - 15;
    const r = Math.floor(Math.max(0, Math.min(255, 139 + variation)));
    const g = Math.floor(Math.max(0, Math.min(255, 98 + variation)));
    const b = Math.floor(Math.max(0, Math.min(255, 57 + variation)));
    context.fillStyle = `rgb(${r}, ${g}, ${b})`;
    context.fillRect(x, y, 3, 3);
  }
}

function generateRockTexture(context: OffscreenCanvasRenderingContext2D, size: number) {
  // Base gray color
  context.fillStyle = '#808080';
  context.fillRect(0, 0, size, size);
  
  // Report progress
  self.postMessage({ type: 'rock', progress: 50 });
  
  // Add rock variations
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const variation = Math.random() * 60 - 30;
    const gray = Math.floor(Math.max(0, Math.min(255, 128 + variation)));
    context.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    context.fillRect(x, y, 4, 4);
  }
  
  // A few dark spots
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    context.fillStyle = '#404040';
    context.fillRect(x, y, 2, 2);
  }
}

export {};