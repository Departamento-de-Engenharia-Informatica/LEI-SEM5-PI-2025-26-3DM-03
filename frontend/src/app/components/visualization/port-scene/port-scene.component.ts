import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PortLayoutDTO, PortLayoutService } from '../../../services/visualization/port-layout.service';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-port-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './port-scene.component.html',
  styleUrls: ['./port-scene.component.scss'],
})
export class PortSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas3d', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private waterGeom?: THREE.PlaneGeometry;
  private waterBase?: Float32Array;
  private clock = new THREE.Clock();

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
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd7ea);
    // Fog para dar profundidade (distâncias grandes)
    this.scene.fog = new THREE.Fog(0xbfd7ea, 800, 5500);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
    this.camera.position.set(300, 250, 400);

  this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
  this.renderer.shadowMap.enabled = true;
  this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Basic lights (helps later US 3.3.5)
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);
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

  // Luz secundária suave para preencher sombras
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(1200, 700, -800);
  this.scene.add(fill);

    // Orbit controls (helps 3.3.6 later)
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 2000;
    this.controls.target.set(0, 0, 0);
  }

  private buildFromLayout(layout: PortLayoutDTO) {
    console.log('[PortScene] layout recebido', layout);
    // CENA BASE
    // ----------

    // --- ÁGUA (com ondulação) ---
    const segs = 200;
    this.waterGeom = new THREE.PlaneGeometry(layout.water.width, layout.water.height, segs, segs);
    this.waterBase = (this.waterGeom.attributes['position'].array as Float32Array).slice(0);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x5fb3ff,
      roughness: 0.4,
      metalness: 0.08,
      reflectivity: 0.25,
      clearcoat: 0.35,
      transmission: 0.0,
      sheen: 0.15,
    });

    const water = new THREE.Mesh(this.waterGeom, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = layout.water.y - 0.1; // ligeiramente abaixo do cais
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

    // 1) ZONAS DE TERRA (yards / “porto em si”, ainda sem contentores)
    // ---------------------------------------------------------------
    for (const a of layout.landAreas) {
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
    }

    // 2) CAIS PRINCIPAIS (docks junto à água)
    // --------------------------------------
    let firstDockCenter: THREE.Vector3 | null = null;

    for (const d of layout.docks) {
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
    }

    // 3) CÂMARA APONTADA PARA O PORTO
    // -------------------------------
    if (firstDockCenter) {
      this.framePort(firstDockCenter, layout);
    }

    // Helpers (apenas para desenvolvimento; remover depois se quiser)
    const axes = new THREE.AxesHelper(200);
    axes.position.y = 2;
    this.scene.add(axes);
    const grid = new THREE.GridHelper(4000, 80, 0x444444, 0xcccccc);
    grid.position.y = -0.05;
    this.scene.add(grid);

    this.animate();
  }

  private buildFallback() {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1000, 1000),
      new THREE.MeshStandardMaterial({ color: 0x6699cc })
    );
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);
    this.animate();
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
    const dist = length * 0.9;
    this.controls.target.copy(center);
    this.camera.position.set(center.x - dist, center.y + dist * 0.55, center.z + dist * 0.95);
    this.camera.far = Math.max(this.camera.far, dist * 6);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }
}
