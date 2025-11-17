import * as THREE from 'three';

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  class OrbitControls extends THREE.EventDispatcher {
    constructor(object: THREE.Camera, domElement?: HTMLElement);
    enabled: boolean;
    target: THREE.Vector3;
    enablePan: boolean;
    enableDamping: boolean;
    dampingFactor: number;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    autoRotate: boolean;
    autoRotateSpeed: number;
    update(): void;
    dispose(): void;
  }
  export { OrbitControls };
}
