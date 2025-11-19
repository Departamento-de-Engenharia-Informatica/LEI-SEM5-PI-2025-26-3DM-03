import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPortalLatticeCraneModel } from '../crane/dockcrane.component';

@Component({
  selector: 'app-final-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './final-scene.component.html',
  styleUrls: ['./final-scene.component.scss'],
})
export class FinalSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private waterGeom?: THREE.PlaneGeometry;
  private waterBase?: Float32Array;
  private readonly scene = new THREE.Scene();
  private readonly clock = new THREE.Clock();
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];
  private readonly gltfLoader = new GLTFLoader();
  private readonly textureLoader = new THREE.TextureLoader();
  private containerStackPrototype?: THREE.Group;
  private containerStackLoading?: Promise<THREE.Group>;
  private readonly containerStackUrls = ['assets/models/containers.glb'];
  private readonly containerTargetSpan = 55;
  private readonly containerColors = [0xff8c5f, 0x00c2ff, 0xff4f81, 0x7dd87d, 0xffbf69, 0x9b5de5];
  private containerUnitSize = new THREE.Vector3(40, 16, 80);
  private readonly warehouseModelUrls = ['assets/models/warehouse.glb', 'assets/warehouse.glb'];
  private warehousePrototype?: THREE.Group;
  private warehouseLoading?: Promise<THREE.Group>;
  private warehouseBaseDimensions?: THREE.Vector3;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.initRenderer();
    this.buildScene();

    this.zone.runOutsideAngular(() => {
      this.animate();
      window.addEventListener('resize', this.handleResize, { passive: true });
    });
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    window.removeEventListener('resize', this.handleResize);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.disposableGeometries.forEach((geom) => geom.dispose());
    this.disposableMaterials.forEach((mat) => mat.dispose());
    this.disposableTextures.forEach((tex) => tex.dispose());
  }

  private initRenderer() {
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(bounds?.width || canvas.clientWidth || window.innerWidth, 640);
    const height = Math.max(bounds?.height || 600, 480);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;

    this.camera = new THREE.PerspectiveCamera(48, width / height, 1, 6000);
    this.camera.position.set(-900, 520, 720);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.minDistance = 320;
    this.controls.maxDistance = 2200;
    this.controls.target.set(0, 80, 0);
    this.controls.update();
  }

  private buildScene() {
    this.scene.background = new THREE.Color(0xaed4ff);
    this.scene.fog = new THREE.Fog(0xd8ecff, 1200, 3600);

    this.addLights();
    this.addWater();
    this.addPlatform();
    this.addServiceRoad();
    this.addWarehouses();
    this.addContainerFields();
    this.addCranes();
    this.addDockDetails();
  }

  private addLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8fb3cc, 0.55);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4da, 2.1);
    sun.position.set(-420, 960, 180);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 100;
    sun.shadow.camera.far = 2500;
    sun.shadow.camera.left = -1400;
    sun.shadow.camera.right = 1400;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -800;
    this.scene.add(sun);
  }

  private addWater() {
    this.waterGeom = this.trackGeometry(new THREE.PlaneGeometry(4200, 4200, 220, 220));
    const positionAttr = this.waterGeom.getAttribute('position') as THREE.BufferAttribute;
    this.waterBase = new Float32Array(positionAttr.array as Float32Array);
    const waterMaterial = this.trackMaterial(
      new THREE.MeshPhysicalMaterial({
        color: 0x6fb7ff,
        roughness: 0.08,
        metalness: 0.35,
        transmission: 0.45,
        opacity: 0.95,
        transparent: true,
        reflectivity: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        ior: 1.33,
        thickness: 12
      })
    );

    const water = new THREE.Mesh(this.waterGeom, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -8;
    water.receiveShadow = true;
    this.scene.add(water);

    const foam = new THREE.Mesh(
      this.trackGeometry(new THREE.RingGeometry(720, 900, 80)),
      this.trackMaterial(
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
      )
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, -7.5, 0);
    this.scene.add(foam);
  }

  private addPlatform() {
    const deckDepth = 1350;
    const deckOffsetZ = -200;
    const dockFloorTileSize = 260;
    const deckTexture = this.createDockFloorTexture(1500 / dockFloorTileSize, deckDepth / dockFloorTileSize);
    const apronTexture = this.createDockFloorTexture(1500 / dockFloorTileSize, Math.max(220 / dockFloorTileSize, 1));
    const deck = new THREE.Mesh(
      this.trackGeometry(new THREE.BoxGeometry(1500, 60, deckDepth)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: deckTexture,
          color: 0xffffff,
          roughness: 0.72,
          metalness: 0.12,
        })
      )
    );
    deck.position.y = 30;
    deck.position.z = deckOffsetZ;
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);

    const apron = new THREE.Mesh(
      this.trackGeometry(new THREE.PlaneGeometry(1500, 220)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          map: apronTexture,
          color: 0xffffff,
          roughness: 0.75,
          metalness: 0.08,
        })
      )
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, 61, 320);
    apron.receiveShadow = true;
    this.scene.add(apron);

  }

  private addDockDetails() {
    const bollardGeo = this.trackGeometry(new THREE.CylinderGeometry(4, 4, 8, 16));
    const bollardMat = this.trackMaterial(new THREE.MeshStandardMaterial({ color: 0xfaf3c0, roughness: 0.3 }));
    for (let i = -6; i <= 6; i++) {
      const bollard = new THREE.Mesh(bollardGeo, bollardMat);
      bollard.position.set(i * 110, 70, 360);
      bollard.castShadow = true;
      this.scene.add(bollard);
    }

  }

  private addServiceRoad() {
    const roadWidth = 520;
    const roadDepth = 1350;
    const road = new THREE.Mesh(
      this.trackGeometry(new THREE.PlaneGeometry(roadWidth, roadDepth)),
      this.trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x4b4b50,
          roughness: 0.9,
          metalness: 0.05,
        })
      )
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(-410, 60.5, -180);
    road.receiveShadow = true;
    this.scene.add(road);

  }

  private addWarehouses() {
    const placements: { position: THREE.Vector3; size: THREE.Vector3; rotation?: number }[] = [
      { position: new THREE.Vector3(-460, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
      { position: new THREE.Vector3(60, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
      { position: new THREE.Vector3(580, 60, -820), size: new THREE.Vector3(320, 150, 240), rotation: 0 },
    ];

    this.getWarehousePrototype()
      .then((prototype) => {
        placements.forEach((placement) => {
          const warehouse = this.instantiateWarehouse(prototype, placement);
          this.scene.add(warehouse);
        });
      })
      .catch((error) => console.warn('[FinalScene] Falha ao carregar warehouse GLB', error));
  }

  private getWarehousePrototype(): Promise<THREE.Group> {
    if (this.warehousePrototype) {
      return Promise.resolve(this.warehousePrototype);
    }
    if (!this.warehouseLoading) {
      this.warehouseLoading = new Promise((resolve, reject) => {
        const urls = [...this.warehouseModelUrls];
        const loadNext = () => {
          const url = urls.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de armazém disponível'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              const root = gltf.scene;
              root.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                  obj.castShadow = true;
                  obj.receiveShadow = true;
                }
              });
              const box = new THREE.Box3().setFromObject(root);
              const size = new THREE.Vector3();
              const center = new THREE.Vector3();
              box.getSize(size);
              box.getCenter(center);
              root.position.x -= center.x;
              root.position.z -= center.z;
              root.position.y -= box.min.y;
              this.warehouseBaseDimensions = size;
              this.warehousePrototype = root;
              resolve(root);
            },
            undefined,
            (error) => {
              console.warn('[FinalScene] erro ao carregar warehouse modelo', url, error);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.warehouseLoading;
  }

  private instantiateWarehouse(
    prototype: THREE.Group,
    placement: { position: THREE.Vector3; size: THREE.Vector3; rotation?: number }
  ): THREE.Group {
    const warehouse = prototype.clone(true);
    const dims = this.warehouseBaseDimensions ?? new THREE.Vector3(1, 1, 1);
    warehouse.scale.set(placement.size.x / dims.x, placement.size.y / dims.y, placement.size.z / dims.z);
    warehouse.position.copy(placement.position);
    warehouse.rotation.y = placement.rotation ?? 0;
    warehouse.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return warehouse;
  }

  private animate = () => {
    if (this.waterGeom && this.waterBase) {
      const attr = this.waterGeom.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const t = this.clock.getElapsedTime();
      for (let i = 0; i < arr.length; i += 3) {
        const baseZ = this.waterBase[i + 2];
        const baseX = this.waterBase[i];
        const baseY = this.waterBase[i + 1];
        const wave = Math.sin(baseX * 0.002 + t * 0.6) + Math.cos(baseY * 0.0025 - t * 0.9);
        arr[i + 2] = baseZ + wave * 1.4;
      }
      attr.needsUpdate = true;
      this.waterGeom.computeVertexNormals();
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private handleResize = () => {
    if (!this.renderer || !this.camera) {
      return;
    }
    const canvas = this.canvasRef.nativeElement;
    const bounds = canvas.parentElement?.getBoundingClientRect();
    const width = Math.max(bounds?.width || window.innerWidth, 640);
    const height = Math.max(bounds?.height || 600, 480);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private trackMaterial<T extends THREE.Material>(material: T): T {
    this.disposableMaterials.push(material);
    return material;
  }

  private trackGeometry<T extends THREE.BufferGeometry>(geometry: T): T {
    this.disposableGeometries.push(geometry);
    return geometry;
  }

  private trackTexture<T extends THREE.Texture>(texture: T): T {
    this.disposableTextures.push(texture);
    return texture;
  }

  private createDockFloorTexture(repeatX: number, repeatY: number): THREE.Texture {
    const texture = this.trackTexture(this.textureLoader.load('assets/textures/floor.png'));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    const maxAnisotropy = this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : texture.anisotropy;
    texture.anisotropy = maxAnisotropy;
    texture.repeat.set(Math.max(repeatX, 1), Math.max(repeatY, 1));
    texture.needsUpdate = true;
    return texture;
  }

  private addContainerFields() {
    const placements: { position: THREE.Vector3; rotation?: number; cols: number; rows: number; maxLevels: number }[] =
      [];
    const laneZ = [-420, -320, -220, -120, -20, 80];
    const laneX = [-320, 0, 320];
    const laneHeights = [7, 6, 5, 4, 3, 2];
    laneZ.forEach((z, idxZ) => {
      laneX.forEach((x, idxX) => {
        const cols = 4;
        const rows = 3;
        const baseMax = laneHeights[idxZ % laneHeights.length];
        let maxLevels = Math.max(2, baseMax - Math.max(0, idxX - 1));
        if (idxZ === 0) {
          maxLevels = Math.max(1, baseMax - idxX - (idxX === 2 ? 2 : idxX));
        }
        placements.push({ position: new THREE.Vector3(x, 60, z), cols, rows, maxLevels });
      });
    });

    this.getContainerStackPrototype()
      .then((prototype) => {
        placements.forEach((placement, index) => {
          const stack = this.buildContainerStack(prototype, placement.cols, placement.rows, placement.maxLevels, index * 13);
          stack.position.copy(placement.position);
          stack.rotation.y = placement.rotation ?? 0;
          stack.updateMatrixWorld(true);
          this.scene.add(stack);
        });
      })
      .catch((err) => console.error('[FinalScene] Falha ao carregar contentores GLB', err));
  }

  private addCranes() {
    const offsets = [-360, 360];
    offsets.forEach((x) => {
      const crane = createPortalLatticeCraneModel({
        height: 90,
        seawardBoomLength: 190,
        landsideBoomLength: 80,
        gauge: 74,
        clearance: 70,
      });
      crane.position.set(x, 60, 250);
      crane.scale.setScalar(1.4);
      crane.rotation.y = Math.PI;
      this.scene.add(crane);
    });
  }

  private buildContainerStack(
    prototype: THREE.Group,
    columns: number,
    rows: number,
    maxLevels: number,
    seed: number
  ): THREE.Group {
    const group = new THREE.Group();
    const spacingX = this.containerUnitSize.x + 3;
    const spacingZ = this.containerUnitSize.z + 4;
    const spacingY = this.containerUnitSize.y + 1.5;
    const offsetX = ((columns - 1) * spacingX) / 2;
    const offsetZ = ((rows - 1) * spacingZ) / 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const maxAllowed = Math.max(1, maxLevels);
        const stackHeight = Math.max(2, 1 + ((row + col * 2 + seed) % maxAllowed));
        for (let level = 0; level < stackHeight; level++) {
          const color = this.containerColors[(row + col + level + seed) % this.containerColors.length];
          const container = this.cloneContainerPrototype(prototype, color);
          container.position.set(
            col * spacingX - offsetX,
            level * spacingY,
            row * spacingZ - offsetZ
          );
          group.add(container);
        }
      }
    }

    return group;
  }

  private cloneContainerPrototype(prototype: THREE.Group, color: number): THREE.Group {
    const clone = prototype.clone(true);
    const tint = new THREE.Color(color);
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = (obj.material as THREE.Material).clone() as THREE.MeshStandardMaterial;
        if (mat.color) {
          mat.color.copy(tint);
        }
        mat.needsUpdate = true;
        obj.material = mat;
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return clone;
  }

  private getContainerStackPrototype(): Promise<THREE.Group> {
    if (this.containerStackPrototype) {
      return Promise.resolve(this.containerStackPrototype);
    }

    if (!this.containerStackLoading) {
      this.containerStackLoading = new Promise((resolve, reject) => {
        const queue = [...this.containerStackUrls];
        const loadNext = () => {
          const url = queue.shift();
          if (!url) {
            reject(new Error('Sem modelo GLB de contentores disponível'));
            return;
          }
          this.gltfLoader.load(
            url,
            (gltf) => {
              const root = gltf.scene;
              this.prepareGlbContainerPrototype(root);
              this.containerStackPrototype = root;
              resolve(root);
            },
            undefined,
            (err) => {
              console.warn('[FinalScene] Falha ao carregar modelo', url, err);
              loadNext();
            }
          );
        };
        loadNext();
      });
    }

    return this.containerStackLoading;
  }

  private prepareGlbContainerPrototype(root: THREE.Group) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if ((mesh as any).isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = this.containerTargetSpan / maxDim;
    root.scale.setScalar(scale);
    root.updateMatrixWorld(true);

    const normalizedBox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    normalizedBox.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= normalizedBox.min.y;
    this.containerUnitSize = normalizedBox.getSize(new THREE.Vector3());
  }
}

