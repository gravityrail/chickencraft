import { Mesh, VertexData, StandardMaterial, Scene, Vector3 } from '@babylonjs/core';
import { Chunk, CHUNK_WIDTH, CHUNK_HEIGHT, CHUNK_DEPTH } from './Chunk';
import { BlockRegistry } from './Block';
import { World } from './World';

interface Face {
  vertices: number[];
  uvs: number[];
  normals: number[];
  indices: number[];
}

export class ChunkMesher {
  private static atlasSize = 16;
  
  static createChunkMesh(chunk: Chunk, world: World, scene: Scene, material: StandardMaterial): Mesh | null {
    const faces: Face = {
      vertices: [],
      uvs: [],
      normals: [],
      indices: []
    };
    
    const chunkPos = chunk.getWorldPosition();
    
    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_DEPTH; z++) {
          const blockId = chunk.getBlockId(x, y, z);
          
          if (blockId === 0) continue;
          
          const block = BlockRegistry.getBlock(blockId);
          if (!block) continue;
          
          const worldX = chunkPos.x + x;
          const worldY = chunkPos.y + y;
          const worldZ = chunkPos.z + z;
          
          if (this.shouldRenderFace(world, worldX, worldY + 1, worldZ)) {
            this.addFace(faces, x, y, z, 0, block.faceTiles[0]);
          }
          
          if (this.shouldRenderFace(world, worldX, worldY - 1, worldZ)) {
            this.addFace(faces, x, y, z, 1, block.faceTiles[1]);
          }
          
          if (this.shouldRenderFace(world, worldX, worldY, worldZ + 1)) {
            this.addFace(faces, x, y, z, 2, block.faceTiles[2]);
          }
          
          if (this.shouldRenderFace(world, worldX, worldY, worldZ - 1)) {
            this.addFace(faces, x, y, z, 3, block.faceTiles[3]);
          }
          
          if (this.shouldRenderFace(world, worldX + 1, worldY, worldZ)) {
            this.addFace(faces, x, y, z, 4, block.faceTiles[4]);
          }
          
          if (this.shouldRenderFace(world, worldX - 1, worldY, worldZ)) {
            this.addFace(faces, x, y, z, 5, block.faceTiles[5]);
          }
        }
      }
    }
    
    if (faces.vertices.length === 0) {
      return null;
    }
    
    const mesh = new Mesh(`chunk_${chunk.getCoord().x}_${chunk.getYOffset()}_${chunk.getCoord().z}`, scene);
    
    const vertexData = new VertexData();
    vertexData.positions = faces.vertices;
    vertexData.uvs = faces.uvs;
    vertexData.normals = faces.normals;
    vertexData.indices = faces.indices;
    
    vertexData.applyToMesh(mesh);
    mesh.material = material;
    mesh.position = new Vector3(chunkPos.x, chunkPos.y, chunkPos.z);
    
    chunk.clearDirty();
    
    return mesh;
  }
  
  private static shouldRenderFace(world: World, x: number, y: number, z: number): boolean {
    const neighborBlock = world.getBlock({ x, y, z });
    return !BlockRegistry.isOpaque(neighborBlock);
  }
  
  private static addFace(faces: Face, x: number, y: number, z: number, faceIndex: number, textureId: number): void {
    const vertexOffset = faces.vertices.length / 3;
    
    const positions = this.getFaceVertices(x, y, z, faceIndex);
    const normals = this.getFaceNormals(faceIndex);
    const uvs = this.getTextureUVs(textureId);
    
    faces.vertices.push(...positions);
    faces.normals.push(...normals);
    faces.uvs.push(...uvs);
    
    faces.indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset + 2, vertexOffset + 3, vertexOffset
    );
  }
  
  private static getFaceVertices(x: number, y: number, z: number, face: number): number[] {
    const vertices: number[][] = [
      [
        x, y + 1, z,
        x + 1, y + 1, z,
        x + 1, y + 1, z + 1,
        x, y + 1, z + 1
      ],
      [
        x, y, z + 1,
        x + 1, y, z + 1,
        x + 1, y, z,
        x, y, z
      ],
      [
        x, y, z + 1,
        x, y + 1, z + 1,
        x + 1, y + 1, z + 1,
        x + 1, y, z + 1
      ],
      [
        x + 1, y, z,
        x + 1, y + 1, z,
        x, y + 1, z,
        x, y, z
      ],
      [
        x + 1, y, z,
        x + 1, y, z + 1,
        x + 1, y + 1, z + 1,
        x + 1, y + 1, z
      ],
      [
        x, y, z + 1,
        x, y, z,
        x, y + 1, z,
        x, y + 1, z + 1
      ]
    ];
    
    return vertices[face];
  }
  
  private static getFaceNormals(face: number): number[] {
    const normals: number[][] = [
      [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
      [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
      [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0]
    ];
    
    return normals[face];
  }
  
  private static getTextureUVs(textureId: number): number[] {
    const tileX = textureId % this.atlasSize;
    const tileY = Math.floor(textureId / this.atlasSize);
    
    const uMin = tileX / this.atlasSize;
    const uMax = (tileX + 1) / this.atlasSize;
    const vMin = tileY / this.atlasSize;
    const vMax = (tileY + 1) / this.atlasSize;
    
    return [
      uMin, vMax,
      uMax, vMax,
      uMax, vMin,
      uMin, vMin
    ];
  }
}