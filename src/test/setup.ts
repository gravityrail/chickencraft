import { vi } from 'vitest';

global.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  fillStyle: '',
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4)
  })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(4)
  })),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
  transform: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  rect: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  clip: vi.fn(),
  isPointInPath: vi.fn(),
  isPointInStroke: vi.fn(),
  strokeStyle: '',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  lineDashOffset: 0,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'ltr',
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  getLineDash: vi.fn(() => []),
  setLineDash: vi.fn(),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over'
})) as any;

global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16)) as any;
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id)) as any;

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

class MockPointerEvent extends MouseEvent {
  public pointerId: number;
  public width: number;
  public height: number;
  public pressure: number;
  public tangentialPressure: number;
  public tiltX: number;
  public tiltY: number;
  public twist: number;
  public pointerType: string;
  public isPrimary: boolean;
  
  constructor(type: string, init?: PointerEventInit) {
    super(type, init);
    this.pointerId = init?.pointerId ?? 0;
    this.width = init?.width ?? 1;
    this.height = init?.height ?? 1;
    this.pressure = init?.pressure ?? 0;
    this.tangentialPressure = init?.tangentialPressure ?? 0;
    this.tiltX = init?.tiltX ?? 0;
    this.tiltY = init?.tiltY ?? 0;
    this.twist = init?.twist ?? 0;
    this.pointerType = init?.pointerType ?? 'mouse';
    this.isPrimary = init?.isPrimary ?? false;
  }
}

global.PointerEvent = MockPointerEvent as any;