import * as THREE from 'three';

export interface GroundModuleOptions {
  width: number;
  depth: number;
  height?: number;
  color?: number;
  textureUrl?: string;
  texture?: THREE.Texture;
  textureRepeat?: { x: number; y: number };
  road?: GroundRoadOptions;
}

export interface GroundRoadOptions {
  width?: number;
  depth?: number;
  offsetX?: number;
  offsetZ?: number;
  textureUrl?: string;
  color?: number;
  textureRepeat?: { x: number; y: number };
  heightOffset?: number;
}

const DEFAULT_TEXTURE_URL = 'assets/textures/floor.png';
const DEFAULT_ROAD_TEXTURE_URL = 'assets/textures/textura-da-estrada-do-asfalto-com-marcacoes-109441328.jpg';

/**
 * Creates a reusable ground module that mirrors the material/scale used in the Final 3D scene.
 * The mesh is returned ready to be positioned/rotated in any scene.
 */
export function createGroundModule(options: GroundModuleOptions): THREE.Mesh {
  const width = options.width;
  const depth = options.depth;
  const height = options.height ?? 6;
  const color = options.color ?? 0xffffff;
  const repeatX = options.textureRepeat?.x ?? Math.max(width / 260, 1);
  const repeatY = options.textureRepeat?.y ?? Math.max(depth / 260, 1);

  const texture = options.texture ?? loadTexture(options.textureUrl ?? DEFAULT_TEXTURE_URL, repeatX, repeatY);

  const material = new THREE.MeshStandardMaterial({
    color,
    map: texture,
    roughness: 0.72,
    metalness: 0.12,
  });

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (options.road) {
    const roadWidth = Math.min(options.road.width ?? width * 0.8, width);
    const roadDepth = Math.min(options.road.depth ?? depth * 0.2, depth);
    const roadRepeatX = options.road.textureRepeat?.x ?? Math.max(roadWidth / 260, 1);
    const roadRepeatY = options.road.textureRepeat?.y ?? Math.max(roadDepth / 160, 1);
    const roadTexture = loadTexture(options.road.textureUrl ?? DEFAULT_ROAD_TEXTURE_URL, roadRepeatX, roadRepeatY);
    const roadMaterial = new THREE.MeshStandardMaterial({
      map: roadTexture,
      color: options.road.color ?? 0xffffff,
      roughness: 0.9,
      metalness: 0.08,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, roadDepth), roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(
      options.road.offsetX ?? 0,
      height / 2 + (options.road.heightOffset ?? 0.3),
      options.road.offsetZ ?? 0
    );
    road.receiveShadow = true;
    mesh.add(road);
  }

  return mesh;
}

function loadTexture(url: string, repeatX: number, repeatY: number): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  return texture;
}
