import * as THREE from 'three';

const DEFAULT_TRAILER_MATERIALS = new Set(['col_box', 'col_besi_box', 'col_body']);
const DEFAULT_TRAILER_NODE_PREFIXES = ['Cube'];
const DEFAULT_CAB_NODE_PREFIXES = ['truck_daf', 'truck_daf.', 'ban_depan', 'cerobong_asp'];
const DEFAULT_CAB_MATERIALS = new Set(['col_body', 'col_besi_box']);
const DEFAULT_WINDOW_MATERIALS = new Set(['col_kaca']);

export interface TruckVisualOptions {
  trailerMaterialNames?: Iterable<string>;
  trailerNodePrefixes?: string[];
  cabNodePrefixes?: string[];
  cabMaterialNames?: Iterable<string>;
  cabColor?: THREE.ColorRepresentation;
}

export function applyTruckTrailerTexture(
  root: THREE.Object3D,
  texture: THREE.Texture,
  options: TruckVisualOptions = {}
): void {
  const trailerTargets =
    options.trailerMaterialNames === undefined
      ? DEFAULT_TRAILER_MATERIALS
      : new Set(options.trailerMaterialNames);
  const trailerNodePrefixes = options.trailerNodePrefixes ?? DEFAULT_TRAILER_NODE_PREFIXES;
  const cabNodePrefixes = options.cabNodePrefixes ?? DEFAULT_CAB_NODE_PREFIXES;
  const cabTargets =
    options.cabMaterialNames === undefined ? DEFAULT_CAB_MATERIALS : new Set(options.cabMaterialNames);
  const cabColor = new THREE.Color(options.cabColor ?? 0x000000);

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const objectName = object.name ?? '';
    const isTrailerNode = trailerNodePrefixes.some((prefix) => objectName.startsWith(prefix));
    const isCabNode = cabNodePrefixes.some((prefix) => objectName.startsWith(prefix));

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) {
        continue;
      }
      const materialName = mat.name?.trim();
      if (isCabNode && materialName && cabTargets.has(materialName)) {
        mat.map = null;
        mat.color.copy(cabColor);
        mat.needsUpdate = true;
        continue;
      }

      if (!materialName || !trailerTargets.has(materialName)) {
        continue;
      }

      if (!isTrailerNode) {
        // Avoid texturizar cabina que partilha materiais com o reboque.
        continue;
      }

      mat.map = texture;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  });
}

export function applyTruckWindowTexture(
  root: THREE.Object3D,
  texture: THREE.Texture,
  materialNames: Iterable<string> = DEFAULT_WINDOW_MATERIALS
): void {
  const targets = materialNames === DEFAULT_WINDOW_MATERIALS ? DEFAULT_WINDOW_MATERIALS : new Set(materialNames);

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const mat of materials) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) {
        continue;
      }
      const materialName = mat.name?.trim();
      if (!materialName || !targets.has(materialName)) {
        continue;
      }

      mat.map = texture;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    }
  });
}
