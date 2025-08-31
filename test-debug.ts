// Debug script to understand chunk coordinate conversion
const CHUNK_WIDTH = 32;

function worldToChunkCoord(worldX: number) {
  return Math.floor(worldX / CHUNK_WIDTH);
}

function worldToLocalCoord(worldX: number) {
  return ((worldX % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
}

// Test x=31
console.log('x=31:');
console.log('  Chunk:', worldToChunkCoord(31));
console.log('  Local:', worldToLocalCoord(31));

// Test x=32
console.log('x=32:');
console.log('  Chunk:', worldToChunkCoord(32));
console.log('  Local:', worldToLocalCoord(32));

// Test x=0
console.log('x=0:');
console.log('  Chunk:', worldToChunkCoord(0));
console.log('  Local:', worldToLocalCoord(0));