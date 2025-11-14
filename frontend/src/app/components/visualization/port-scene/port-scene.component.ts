import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import {
  DockLayout,
  LandAreaLayout,
  PortLayoutDTO,
  PortLayoutService,
} from '../../../services/visualization/port-layout.service';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type VesselPalette = {
  hull: number;
  deck: number;
  accent: number;
  cabin: number;
};

@Component({
  selector: 'app-port-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './port-scene.component.html',
  styleUrls: ['./port-scene.component.scss'],
})
export class PortSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() toneMappingExposure = 1.05;
  @Input() orbitDistanceFactor = 0.9;
  @Input() orbitElevationFactor = 0.55;
  @Input() enableAutoRotate = false;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private waterGeom?: THREE.PlaneGeometry;
  private waterBase?: Float32Array;
  private clock = new THREE.Clock();
  private readonly showDebugHelpers = false;
  private readonly containerPalette: number[] = [
    0xff6b6b,
    0xffbe0b,
    0x00bbf9,
    0x48cae4,
    0x9b5de5,
    0xf15bb5,
  ];
  private readonly containerMaterials: THREE.MeshStandardMaterial[] = this.containerPalette.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        metalness: 0.15,
        roughness: 0.38,
      })
  );
  private readonly containerGeometry = new THREE.BoxGeometry(34, 14, 68);
  private readonly craneMaterials = {
    boom: new THREE.MeshStandardMaterial({
      color: 0xf5c344,
      metalness: 0.42,
      roughness: 0.32,
    }),
    cabin: new THREE.MeshStandardMaterial({
      color: 0x2f3e46,
      metalness: 0.15,
      roughness: 0.55,
    }),
    counterWeight: new THREE.MeshStandardMaterial({
      color: 0xcdd5df,
      metalness: 0.3,
      roughness: 0.48,
    }),
    cable: new THREE.MeshStandardMaterial({
      color: 0x1d1d1d,
      metalness: 0.35,
      roughness: 0.6,
    }),
  };
  private readonly randomBaseSeed = 947;
  private readonly yardStripeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
  });
  private readonly foamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly bollardGeometry = new THREE.CylinderGeometry(2.2, 2.4, 4.5, 12);
  private readonly bollardMaterial = new THREE.MeshStandardMaterial({
    color: 0x2b2b2b,
    metalness: 0.55,
    roughness: 0.35,
  });
  private readonly poleGeometry = new THREE.CylinderGeometry(0.8, 0.8, 40, 8);
  private readonly poleHeadGeometry = new THREE.BoxGeometry(3.2, 1.4, 5.6);
  private readonly poleMaterial = new THREE.MeshStandardMaterial({
    color: 0xdadada,
    metalness: 0.5,
    roughness: 0.45,
  });
  private readonly lightEmissiveMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff6bf,
  });
  private readonly vesselPalettes: VesselPalette[] = [
    { hull: 0x10375c, deck: 0xf4f8ff, accent: 0xff595e, cabin: 0xd8e2f1 },
    { hull: 0x0b4f6c, deck: 0xf5f0e1, accent: 0xf4a259, cabin: 0xffffff },
    { hull: 0x274060, deck: 0xe9f1ff, accent: 0x4ecdc4, cabin: 0xfffbe6 },
  ];

  constructor(private layoutApi: PortLayoutService) {}

  ngAfterViewInit(): void {
    this.initThree();
    this.layoutApi.getLayout().subscribe({
      next: (layout) => this.buildFromLayout(layout),
      error: (err) => {
        console.error('[PortScene] failed to load layout', err);
        this.buildFallback();
      },
    });
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.containerGeometry.dispose();
    this.containerMaterials.forEach((mat) => mat.dispose());
    Object.values(this.craneMaterials).forEach((mat) => mat.dispose());
    this.yardStripeMaterial.dispose();
    this.foamMaterial.dispose();
    this.bollardGeometry.dispose();
    this.bollardMaterial.dispose();
    this.poleGeometry.dispose();
    this.poleHeadGeometry.dispose();
    this.poleMaterial.dispose();
    this.lightEmissiveMaterial.dispose();
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe8f5);
    this.scene.fog = new THREE.Fog(0xd2e4f3, 800, 5200);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.position.set(300, 250, 400);

  this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.toneMappingExposure;

    // Basic lights (helps later US 3.3.5)
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xdbefff, 0x1c2b3a, 0.35);
    this.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(-600, 900, 600);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 50;
  dir.shadow.camera.far = 6000;
  dir.shadow.camera.left = -2500;
  dir.shadow.camera.right = 2500;
  dir.shadow.camera.top = 2500;
  dir.shadow.camera.bottom = -2500;
    this.scene.add(dir);
  const sunDisk = new THREE.Mesh(
    new THREE.SphereGeometry(80, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff1c1, transparent: true, opacity: 0.75 })
  );
  sunDisk.position.copy(dir.position).setLength(3600);
    this.scene.add(sunDisk);

  // Luz secundária suave para preencher sombras
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(1200, 700, -800);
  this.scene.add(fill);

    // Orbit controls (helps 3.3.6 later)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 140;
    this.controls.maxDistance = 2000;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.autoRotate = this.enableAutoRotate;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.target.set(0, 0, 0);
  }

  private buildFromLayout(layout: PortLayoutDTO) {
    console.log('[PortScene] layout recebido', layout);
    const sceneLayout = this.hasSceneContent(layout) ? layout : this.createDemoLayout();
    if (sceneLayout !== layout) {
      console.info('[PortScene] usando layout demonstrativo enquanto não existem dados reais');
    }
    this.addBackdropElements(sceneLayout);
    // CENA BASE
    // ----------

    // --- ÁGUA (com ondulação) ---
    const segs = 200;
    this.waterGeom = new THREE.PlaneGeometry(sceneLayout.water.width, sceneLayout.water.height, segs, segs);
    this.waterBase = (this.waterGeom.attributes['position'].array as Float32Array).slice(0);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x3f7fb4,
      roughness: 0.2,
      metalness: 0.02,
      reflectivity: 0.55,
      clearcoat: 0.8,
      clearcoatRoughness: 0.35,
      transmission: 0.65,
      thickness: 18,
      ior: 1.33,
      sheen: 0.12,
      sheenColor: new THREE.Color(0xcbe8ff),
      specularIntensity: 0.9,
    });

    const water = new THREE.Mesh(this.waterGeom, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = sceneLayout.water.y - 0.1; // ligeiramente abaixo do cais
    water.receiveShadow = true;
    this.scene.add(water);

    // --- MATERIAIS DE BETÃO / ASFALTO ---
    const dockTopMat = new THREE.MeshStandardMaterial({
      color: 0xd9d9d9,
      roughness: 0.92,
      metalness: 0.02,
    });

    const dockSideMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaf,
      roughness: 0.92,
      metalness: 0.03,
    });

    const dockBottomMat = new THREE.MeshStandardMaterial({
      color: 0x7c8088,
      roughness: 1.0,
      metalness: 0.0,
    });

    const yardTopMat = new THREE.MeshStandardMaterial({
      color: 0xe2e2e2, // “asfalto” mais claro
      roughness: 0.94,
      metalness: 0.02,
    });

    const yardSideMat = new THREE.MeshStandardMaterial({
      color: 0xb8b8b8,
      roughness: 0.93,
      metalness: 0.02,
    });

    const warehouseWallMat = new THREE.MeshStandardMaterial({
      color: 0xe7dfd1,
      roughness: 0.78,
      metalness: 0.04,
    });
    const warehouseRoofMat = new THREE.MeshStandardMaterial({
      color: 0xcbb99b,
      roughness: 0.92,
      metalness: 0.02,
    });
    const warehouseBaseMat = new THREE.MeshStandardMaterial({
      color: 0x8a8b90,
      roughness: 1.0,
      metalness: 0.01,
    });

    // 1) ZONAS DE TERRA (yards / “porto em si”, ainda sem contentores)
    // ---------------------------------------------------------------
    for (const a of sceneLayout.landAreas) {
      const height = 6; // espessura da placa de betão/asfalto
      const geo = new THREE.BoxGeometry(a.width, height, a.depth);
      const mats: THREE.Material[] = [
        yardSideMat,  // +x
        yardSideMat,  // -x
        yardTopMat,   // +y (topo)
        dockBottomMat, // -y
        yardSideMat,  // +z
        yardSideMat,  // -z
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(a.x, a.y + height / 2, a.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addContainerStacks(a, a.y + height);
      this.addYardMarkings(a, a.y + height);
      this.addYardLighting(a, a.y + height);
    }

    // 2.b) Armazéns (StorageAreaType.Warehouse -> volumes fechados)
    for (const w of sceneLayout.warehouses ?? []) {
      const geo = new THREE.BoxGeometry(w.size.width, w.size.height, w.size.depth);
      const mats: THREE.Material[] = [
        warehouseWallMat,
        warehouseWallMat,
        warehouseRoofMat,
        warehouseBaseMat,
        warehouseWallMat,
        warehouseWallMat,
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(w.position.x, w.position.y + w.size.height / 2, w.position.z);
      mesh.rotation.y = w.rotationY || 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // 2) CAIS PRINCIPAIS (docks junto à água)
    // --------------------------------------
    let firstDockCenter: THREE.Vector3 | null = null;

    for (const d of sceneLayout.docks) {
      const geo = new THREE.BoxGeometry(d.size.length, d.size.height, d.size.width);
      // Ordem das faces: +x, -x, +y (topo), -y (baixo), +z, -z
      const mats: THREE.Material[] = [
        dockSideMat,
        dockSideMat,
        dockTopMat,
        dockBottomMat,
        dockSideMat,
        dockSideMat,
      ];

      const mesh = new THREE.Mesh(geo, mats);
      mesh.position.set(d.position.x, d.position.y + d.size.height / 2, d.position.z);
      mesh.rotation.y = d.rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.addCranesForDock(d);

      // Guardar centro do primeiro cais para apontar a câmara
      if (!firstDockCenter) {
        firstDockCenter = new THREE.Vector3(d.position.x, d.position.y, d.position.z);
      }

      // Pequenos “fenders” pretos na borda junto à água (opcional, só para parecer o print)
      const fenderMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
      const fenderGeo = new THREE.BoxGeometry(10, 5, 3);

      const numFenders = Math.max(6, Math.floor(d.size.length / 80));
      const startX = d.position.x - d.size.length / 2 + 20;
      const step = (d.size.length - 40) / (numFenders - 1);

      for (let i = 0; i < numFenders; i++) {
        const fx = startX + i * step;
        const fender = new THREE.Mesh(fenderGeo, fenderMat);
        fender.position.set(fx, d.position.y + 2, d.position.z - d.size.width / 2 - 1.5);
        fender.castShadow = true;
        fender.receiveShadow = true;
        this.scene.add(fender);
      }
      this.decorateDock(d);
    }

    // 3) CÂMARA APONTADA PARA O PORTO
    // -------------------------------
    if (firstDockCenter) {
      this.framePort(firstDockCenter, sceneLayout);
    }
    this.addVessels(sceneLayout);

    // Helpers (apenas para desenvolvimento; remover depois se quiser)
    if (this.showDebugHelpers) {
      const axes = new THREE.AxesHelper(200);
      axes.position.y = 2;
      this.scene.add(axes);
      const grid = new THREE.GridHelper(4000, 80, 0x444444, 0xcccccc);
      grid.position.y = -0.05;
      this.scene.add(grid);
    }

    this.animate();
  }

  private hasSceneContent(layout: PortLayoutDTO): boolean {
    return (
      (layout.docks?.length ?? 0) > 0 ||
      (layout.landAreas?.length ?? 0) > 0 ||
      (layout.warehouses?.length ?? 0) > 0
    );
  }

  private createDemoLayout(): PortLayoutDTO {
    return {
      units: 'meters',
      water: { width: 3200, height: 2200, y: -2 },
      landAreas: [
        { storageAreaId: 1001, name: 'North Yard', x: -520, z: 320, width: 620, depth: 240, y: 0 },
        { storageAreaId: 1002, name: 'Central Yard', x: -20, z: 260, width: 540, depth: 260, y: 0 },
        { storageAreaId: 1003, name: 'South Yard', x: 450, z: 300, width: 520, depth: 220, y: 0 },
      ],
      docks: [
        {
          dockId: 1,
          name: 'Alpha',
          position: { x: -520, y: 2, z: -140 },
          size: { length: 520, width: 110, height: 8 },
          rotationY: 0,
        },
        {
          dockId: 2,
          name: 'Bravo',
          position: { x: -20, y: 2, z: -150 },
          size: { length: 460, width: 120, height: 8 },
          rotationY: 0.05,
        },
        {
          dockId: 3,
          name: 'Charlie',
          position: { x: 420, y: 2, z: -140 },
          size: { length: 500, width: 110, height: 8 },
          rotationY: -0.04,
        },
      ],
      warehouses: [
        {
          storageAreaId: 2001,
          name: 'Cold Storage',
          position: { x: -520, y: 0, z: 640 },
          size: { width: 260, depth: 160, height: 58 },
          rotationY: 0,
        },
        {
          storageAreaId: 2002,
          name: 'Logistics Hub',
          position: { x: -40, y: 0, z: 660 },
          size: { width: 320, depth: 150, height: 62 },
          rotationY: 0,
        },
        {
          storageAreaId: 2003,
          name: 'Warehouse East',
          position: { x: 420, y: 0, z: 640 },
          size: { width: 280, depth: 140, height: 54 },
          rotationY: 0,
        },
      ],
    };
  }

  private addBackdropElements(layout: PortLayoutDTO) {
    const radius = Math.max(layout.water.width, layout.water.height) * 2.5;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8f3ff, side: THREE.BackSide })
    );
    this.scene.add(sky);

    const haze = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.45, radius * 0.65, 280, 48, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xcadcec,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
    );
    haze.position.y = -60;
    this.scene.add(haze);
  }

  private addYardMarkings(area: LandAreaLayout, platformHeight: number) {
    const usableDepth = area.depth - 120;
    if (usableDepth <= 60) {
      return;
    }
    const stripes = Math.max(2, Math.floor(usableDepth / 70));
    const width = Math.max(60, area.width - 80);
    const spacing = stripes === 1 ? 0 : usableDepth / (stripes - 1);
    for (let i = 0; i < stripes; i++) {
      const geometry = new THREE.PlaneGeometry(width, 1.6);
      const mesh = new THREE.Mesh(geometry, this.yardStripeMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        area.x,
        platformHeight + 0.3,
        area.z - usableDepth / 2 + 60 + spacing * i
      );
      this.scene.add(mesh);
    }
  }

  private addYardLighting(area: LandAreaLayout, platformHeight: number) {
    const poleCount = Math.max(1, Math.floor(area.width / 220));
    const spacing = area.width / (poleCount + 1);
    for (let i = 0; i < poleCount; i++) {
      const pole = this.createLightPole();
      pole.position.set(
        area.x - area.width / 2 + spacing * (i + 1),
        platformHeight,
        area.z + area.depth / 2 - 30
      );
      this.scene.add(pole);
    }
  }

  private addContainerStacks(area: LandAreaLayout, platformHeight: number) {
    const usableWidth = area.width - 100;
    const usableDepth = area.depth - 140;
    if (usableWidth <= 0 || usableDepth <= 0) {
      return;
    }

    const cols = Math.max(1, Math.floor(usableWidth / 80));
    const rows = Math.max(1, Math.floor(usableDepth / 100));
    const startX = area.x - usableWidth / 2;
    const startZ = area.z - usableDepth / 2;
    let placed = 0;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if ((c + r) % 2 !== 0) continue;
        const px = startX + c * (usableWidth / cols) + 40;
        const pz = startZ + r * (usableDepth / rows) + 40;
        const stackSeed = area.storageAreaId * 73 + placed * 11;
        const levels = 1 + Math.round(this.pseudoRandom(stackSeed) * 2);

        for (let level = 0; level < levels; level++) {
          const material = this.containerMaterials[(placed + level) % this.containerMaterials.length];
          const container = new THREE.Mesh(this.containerGeometry, material);
          container.position.set(px, platformHeight + 7 + level * 14, pz);
          container.castShadow = true;
          container.receiveShadow = true;
          this.scene.add(container);
        }
        placed++;
        if (placed > 80) {
          return;
        }
      }
    }
  }

  private decorateDock(dock: DockLayout) {
    const walkway = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(40, dock.size.length - 20), 0.4, dock.size.width * 0.25),
      new THREE.MeshStandardMaterial({
        color: 0xf1f1f1,
        roughness: 0.55,
        metalness: 0.15,
      })
    );
    walkway.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, dock.size.height + 0.3, 0))
    );
    walkway.rotation.y = dock.rotationY;
    walkway.castShadow = true;
    this.scene.add(walkway);

    const foam = new THREE.Mesh(
      new THREE.PlaneGeometry(dock.size.length * 1.05, dock.size.width * 0.9),
      this.foamMaterial
    );
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.y = dock.rotationY;
    foam.position.copy(
      this.relativeToDock(dock, new THREE.Vector3(0, 0.1, -dock.size.width / 2 - 10))
    );
    this.scene.add(foam);

    const bollardCount = Math.max(3, Math.floor(dock.size.length / 70));
    const step = dock.size.length / (bollardCount + 1);
    for (let i = 0; i < bollardCount; i++) {
      const bollard = new THREE.Mesh(this.bollardGeometry, this.bollardMaterial);
      bollard.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(-dock.size.length / 2 + step * (i + 1), dock.size.height + 2.2, 0)
        )
      );
      bollard.rotation.y = dock.rotationY;
      bollard.castShadow = true;
      bollard.receiveShadow = true;
      this.scene.add(bollard);
    }

    const poleCount = Math.max(1, Math.floor(dock.size.length / 220));
    for (let i = 0; i < poleCount; i++) {
      const pole = this.createLightPole();
      pole.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(
            -dock.size.length / 2 + ((i + 1) * dock.size.length) / (poleCount + 1),
            dock.size.height,
            dock.size.width / 2 - 8
          )
        )
      );
      pole.rotation.y = dock.rotationY;
      this.scene.add(pole);
    }
  }

  private createLightPole(): THREE.Group {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(this.poleGeometry, this.poleMaterial);
    pole.position.y = 20;
    const head = new THREE.Mesh(this.poleHeadGeometry, this.poleMaterial);
    head.position.y = 41;
    const lampFront = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1, 3.2), this.lightEmissiveMaterial);
    lampFront.position.set(0, 41, 3.2);
    const lampBack = lampFront.clone();
    lampBack.position.z = -3.2;
    const light = new THREE.PointLight(0xfff7c0, 0.35, 260);
    light.position.y = 41;

    group.add(pole, head, lampFront, lampBack, light);
    return group;
  }

  private addVessels(layout: PortLayoutDTO) {
    if (!layout.docks?.length) return;
    const vesselCount = Math.min(3, layout.docks.length);
    for (let i = 0; i < vesselCount; i++) {
      const dock = layout.docks[(i * 2) % layout.docks.length];
      const palette = this.vesselPalettes[i % this.vesselPalettes.length];
      const variation = this.pseudoRandom(dock.dockId * 17 + i);
      const length = Math.max(160, dock.size.length * (0.55 + variation * 0.25));
      const vessel = this.createVessel(length, palette, i);
      vessel.position.copy(
        this.relativeToDock(
          dock,
          new THREE.Vector3(0, -dock.size.height / 2 + 6, -dock.size.width / 2 - 50)
        )
      );
      vessel.rotation.y = dock.rotationY + Math.PI;
      this.scene.add(vessel);
    }
  }

  private createVessel(length: number, palette: VesselPalette, seed: number): THREE.Group {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: palette.hull,
      roughness: 0.6,
      metalness: 0.25,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: palette.deck,
      roughness: 0.4,
      metalness: 0.1,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.5,
      metalness: 0.2,
    });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: palette.cabin,
      roughness: 0.35,
      metalness: 0.05,
    });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(length, 20, 64), hullMat);
    hull.position.y = 10;
    hull.castShadow = true;
    hull.receiveShadow = true;

    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0, 32, 36, 4, 1), hullMat);
    bow.rotation.z = Math.PI / 2;
    bow.position.set(length / 2 + 10, 8, 0);
    bow.castShadow = true;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(length * 0.65, 8, 46), deckMat);
    deck.position.set(-length * 0.05, 20, 0);
    deck.castShadow = true;

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(length * 0.2, 16, 28), cabinMat);
    bridge.position.set(-length / 4, 26, 0);
    bridge.castShadow = true;

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 18, 16), accentMat);
    funnel.position.set(-length / 3.2, 28, -12);
    funnel.castShadow = true;

    group.add(hull, bow, deck, bridge, funnel);

    const miniStacks = 3 + Math.round(this.pseudoRandom(seed * 31) * 2);
    for (let i = 0; i < miniStacks; i++) {
      const mini = new THREE.Mesh(
        this.containerGeometry,
        this.containerMaterials[(i + seed) % this.containerMaterials.length]
      );
      mini.scale.set(0.7, 0.85, 0.55);
      const factor = miniStacks === 1 ? 0.5 : i / (miniStacks - 1);
      const x = -length * 0.25 + factor * (length * 0.5);
      mini.position.set(x, 22, (i % 2 === 0 ? 1 : -1) * 12);
      mini.castShadow = true;
      mini.receiveShadow = true;
      group.add(mini);
    }

    return group;
  }

  private addCranesForDock(dock: DockLayout) {
    const length = dock.size.length;
    const craneCount = Math.max(1, Math.round(length / 260));
    const spacing = length / (craneCount + 1);
    const dockTopY = dock.position.y + dock.size.height;

    for (let i = 0; i < craneCount; i++) {
      const localX = -length / 2 + spacing * (i + 1);
      const offset = new THREE.Vector3(localX, dockTopY + 32, -dock.size.width / 2 - 20);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dock.rotationY);
      const crane = this.createCrane();
      crane.position.set(dock.position.x + offset.x, offset.y, dock.position.z + offset.z);
      crane.rotation.y = dock.rotationY;
      this.scene.add(crane);
    }
  }

  private createCrane(): THREE.Group {
    const group = new THREE.Group();
    const column = new THREE.Mesh(new THREE.BoxGeometry(20, 90, 24), this.craneMaterials.boom);
    column.position.y = 45;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 150), this.craneMaterials.boom);
    arm.position.set(0, 90, -70);
    arm.rotation.x = -Math.PI / 16;
    const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(32, 22, 32), this.craneMaterials.counterWeight);
    counterWeight.position.set(0, 90, 70);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(24, 20, 24), this.craneMaterials.cabin);
    cabin.position.set(0, 70, -24);
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(18, 10, 18), this.craneMaterials.cabin);
    trolley.position.set(0, 80, -40);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 46, 8), this.craneMaterials.cable);
    cable.position.set(0, 55, -40);

    [column, arm, counterWeight, cabin, trolley, cable].forEach((mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });

    return group;
  }

  private pseudoRandom(seed: number): number {
    const x = Math.sin(seed + this.randomBaseSeed) * 10000;
    return x - Math.floor(x);
  }

  private relativeToDock(dock: DockLayout, offset: THREE.Vector3): THREE.Vector3 {
    const rotated = offset.clone();
    rotated.applyAxisAngle(new THREE.Vector3(0, 1, 0), dock.rotationY);
    rotated.x += dock.position.x;
    rotated.y += dock.position.y;
    rotated.z += dock.position.z;
    return rotated;
  }

  private buildFallback() {
    this.buildFromLayout(this.createDemoLayout());
  }

  private animate = () => {
    // Simple Gerstner-like ripples over the water plane
    if (this.waterGeom && this.waterBase) {
      const pos = this.waterGeom.attributes['position'] as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const base = this.waterBase;
      const t = this.clock.getElapsedTime();
      const amp = 0.6; // wave height
      const f1 = 0.0025;
      const f2 = 0.0036;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i + 0];
        const y = base[i + 1];
        const z0 = base[i + 2];
        const w = Math.sin(x * f1 + t * 1.2) * Math.cos(y * f2 - t * 0.9);
        arr[i + 2] = z0 + w * amp;
      }
      pos.needsUpdate = true;
      this.waterGeom.computeVertexNormals();
    }

    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.animate);
  };

  private framePort(center: THREE.Vector3, layout: PortLayoutDTO) {
    // Ajusta a câmara para enquadrar principal cais considerando comprimento
    const length = layout.docks[0]?.size.length || 1000;
    const dist = length * this.orbitDistanceFactor;
    this.controls.target.copy(center);
    this.camera.position.set(
      center.x - dist,
      center.y + dist * this.orbitElevationFactor,
      center.z + dist * 0.95
    );
    this.camera.far = Math.max(this.camera.far, dist * 6);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }
}
