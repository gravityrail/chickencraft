export function createVillagerFaceTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Background (skin color)
  ctx.fillStyle = '#f4c2a1';
  ctx.fillRect(0, 0, 32, 32);
  
  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(8, 10, 6, 4);
  ctx.fillRect(18, 10, 6, 4);
  
  // Eye pupils
  ctx.fillStyle = '#4a90e2';
  ctx.fillRect(10, 11, 2, 2);
  ctx.fillRect(20, 11, 2, 2);
  
  // Eyebrows
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(8, 8, 6, 1);
  ctx.fillRect(18, 8, 6, 1);
  
  // Mouth
  ctx.fillStyle = '#d2691e';
  ctx.fillRect(13, 20, 6, 1);
  
  // Hair (top of head)
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(4, 0, 24, 4);
  ctx.fillRect(2, 2, 28, 2);
  
  return canvas.toDataURL();
}

export function createVillagerBodyTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Shirt/robe color (green tunic)
  ctx.fillStyle = '#4a7c59';
  ctx.fillRect(0, 0, 32, 24);
  
  // Belt
  ctx.fillStyle = '#8b4513';
  ctx.fillRect(0, 20, 32, 4);
  
  // Belt buckle
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(14, 21, 4, 2);
  
  // Collar/neckline
  ctx.fillStyle = '#2d5540';
  ctx.fillRect(10, 0, 12, 2);
  
  // Simple pattern on tunic
  ctx.fillStyle = '#2d5540';
  ctx.fillRect(15, 8, 2, 8);
  ctx.fillRect(12, 10, 8, 2);
  
  // Bottom (pants)
  ctx.fillStyle = '#654321';
  ctx.fillRect(0, 24, 32, 8);
  
  return canvas.toDataURL();
}

export function createVillagerSideTexture(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Simple side view - just shirt and pants colors
  // Shirt/robe color (green tunic) - top 75%
  ctx.fillStyle = '#4a7c59';
  ctx.fillRect(0, 0, 32, 24);
  
  // Bottom (pants) - bottom 25%
  ctx.fillStyle = '#654321';
  ctx.fillRect(0, 24, 32, 8);
  
  return canvas.toDataURL();
}