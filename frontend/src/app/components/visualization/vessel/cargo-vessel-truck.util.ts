import * as THREE from 'three';

const TRUCK_NODE_NAMES = new Set(
  [
    'truck_daf',
    'truck_daf.001',
    'truck_daf.002',
    'truck_daf.003',
    'light_ban',
    'light_ban_2',
    'light_ban_3',
    'light_ban_4',
    'light_ban_4.001',
    'ban_depan',
    'cerobong_asp',
    'cube',
    'cube.001',
  ].map(
    (name) => name.toLowerCase()
  )
);

const TRUCK_GEOMETRY_NAMES = new Set(
  ['cylinder.004', 'cylinder.003', 'cylinder.002', 'cube.007', 'cube.006', 'cube.005', 'cube.001', 'cylinder.001', 'cylinder', 'cube.004', 'cube.003', 'cube.002', 'cube'].map((name) =>
    name.toLowerCase()
  )
);

const TRUCK_MATERIAL_NAMES = new Set(
  [
    'col_light_ban',
    'col_ban',
    'col_pelek',
    'uv_ban_belakang_3',
    'col_box',
    'col_besi_box',
    'col_lamp_red',
    'col_body',
    'light',
    'col_black',
    'uv_col_ban_belakang',
    'uv_ban_depan',
    'col_kaca',
  ].map((name) => name.toLowerCase())
);

export function removeEmbeddedTruckFromCargoVessel(root: THREE.Group) {
  const toRemove: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.name && TRUCK_NODE_NAMES.has(obj.name.toLowerCase())) {
      toRemove.push(obj);
      return;
    }
    if (obj instanceof THREE.Mesh) {
      const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      if (materials.length && materials.every((mat) => (mat.name ? TRUCK_MATERIAL_NAMES.has(mat.name.toLowerCase()) : false))) {
        toRemove.push(obj);
        return;
      }
      const geometryName = obj.geometry?.name?.toLowerCase();
      if (geometryName && TRUCK_GEOMETRY_NAMES.has(geometryName)) {
        toRemove.push(obj);
      }
    }
  });
  toRemove.forEach((obj) => obj.parent?.remove(obj));
}
