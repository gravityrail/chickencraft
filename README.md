# Chickencraft

A Minecraft-inspired voxel building game built with TypeScript and Babylon.js.

## Features

- **Voxel-based world** with 1024x1024 world grid
- **6 block types**: Grass, Wood, Brick, Bedrock, Lava, and Chickenhead
- **Procedural terrain generation** with customizable parameters
- **Crafting system** with tools (pickaxe, axe, sword)
- **First-person controls** with WASD movement and mouse look
- **Chunk-based rendering** for performance
- **Water plane** at sea level with underwater effects
- **Block breaking and placing** mechanics

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Controls

- **WASD** - Move forward/backward/left/right
- **Space** - Jump
- **Shift** - Sprint
- **Mouse** - Look around
- **Left Click** - Break block
- **Right Click** - Place block
- **1-9** - Select hotbar slot
- **Scroll Wheel** - Cycle through hotbar
- **E** - Open inventory (coming soon)

## Game Mechanics

### Block Types

1. **Grass** - Basic terrain block with grass texture on top
2. **Wood** - Building material, used for crafting
3. **Brick** - Stone-like material for stronger tools
4. **Bedrock** - Unbreakable, found at world bottom
5. **Lava** - Hazard block that damages player
6. **Chickenhead** - Special decorative block with chicken face

### Crafting Recipes

#### Basic Items
- **Sticks**: 2 Wood blocks vertically = 4 Sticks
- **Crafting Table**: 2x2 Wood blocks = 1 Crafting Table

#### Tools
- **Pickaxe**: 3 material blocks on top row + 2 sticks vertically
- **Axe**: 2 material blocks + 1 below on left + 2 sticks vertically
- **Sword**: 2 material blocks vertically + 1 stick below

Materials can be Wood, Brick, or Chickenhead for different tool tiers.

### World Generation

The world generates with:
- Procedural terrain using simplex noise
- Variable elevation with mountains and valleys
- Water plane at sea level (Y=0)
- Trees scattered across the landscape
- Lava pockets in deep caves
- Bedrock layer at the bottom

## Development

### Project Structure

```
/src
  /engine    - Babylon.js setup and rendering
  /world     - World, chunk, and block systems
  /game      - Player, inventory, crafting
  /test      - Unit tests
  /types     - TypeScript type definitions
```

### Testing

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Check test coverage
npm run test:coverage

# Type checking
npm run typecheck
```

## Performance

- Chunk-based world streaming
- Greedy mesh optimization
- Frustum culling
- Target 60 FPS on mid-range hardware
- 8-chunk default view distance

## Future Features (Roadmap)

- [ ] GUI for inventory and crafting
- [ ] Save/load functionality with IndexedDB
- [ ] Weather and day/night cycle
- [ ] More block types and biomes
- [ ] Multiplayer support
- [ ] Mod support

## License

MIT