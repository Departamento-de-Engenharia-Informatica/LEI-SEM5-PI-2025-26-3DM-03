import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  templateUrl: './warehouse.component.html',
  styleUrls: ['./warehouse.component.scss'],
})
export class WarehouseComponent implements AfterViewInit, OnDestroy {
  @ViewChild('warehouseCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;

  // dimensões principais do módulo
  private readonly WAREHOUSE_WIDTH = 180;
  private readonly WAREHOUSE_DEPTH = 120;
  private readonly WAREHOUSE_HEIGHT = 60;

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  // --------------------------------------------------
  // CICLO ANGULAR
  // --------------------------------------------------

  ngAfterViewInit(): void {
    this.initThreeScene();
    this.addEnvironment();
    this.addWarehouse();
    this.startAnimationLoop();
    window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    this.controls?.dispose();
    this.renderer?.dispose();
    window.removeEventListener('resize', this.onWindowResize);
  }

  // --------------------------------------------------
  // SETUP THREE
  // --------------------------------------------------

  private initThreeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe6ecf4);
    this.scene.fog = new THREE.Fog(0xe6ecf4, 250, 1400);

    const width = this.canvas.clientWidth || 800;
    const height = this.canvas.clientHeight || 450;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    this.camera.position.set(260, 190, 260);
    this.camera.lookAt(0, 40, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Luz ambiente suave
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);

    // Luz hemisférica (céu/chão)
    const hemi = new THREE.HemisphereLight(0xf7fbff, 0x4b5157, 0.7);
    hemi.position.set(0, 400, 0);
    this.scene.add(hemi);

    // Luz direcional principal (tipo sol)
    const dir = new THREE.DirectionalLight(0xffffff, 0.95);
    dir.position.set(260, 320, 200);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    dir.shadow.camera.near = 20;
    dir.shadow.camera.far = 1000;
    dir.shadow.camera.left = -600;
    dir.shadow.camera.right = 600;
    dir.shadow.camera.top = 600;
    dir.shadow.camera.bottom = -600;
    this.scene.add(dir);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 120;
    this.controls.maxDistance = 600;
    this.controls.target.set(0, 45, 0);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
    this.controls.update();
  }

  private onWindowResize = () => {
    if (!this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight || 400;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // --------------------------------------------------
  // AMBIENTE (chão, estrada, relva, marcas)
  // --------------------------------------------------

  private addEnvironment(): void {
    // chão principal (asfalto)
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x6f7379,
      roughness: 0.95,
      metalness: 0.03,
    });

    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      asphaltMat,
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    this.scene.add(asphalt);

    // zona de relva atrás
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x7fbf6b,
      roughness: 0.92,
      metalness: 0.02,
    });
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 600),
      grassMat,
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, 0.02, -700);
    this.scene.add(grass);

    // faixa de passeio em frente ao armazém
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0xbec2c7,
      roughness: 0.9,
      metalness: 0.02,
    });

    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(
        this.WAREHOUSE_WIDTH + 220,
        2,
        this.WAREHOUSE_DEPTH + 80,
      ),
      sidewalkMat,
    );
    sidewalk.position.set(0, 1, 40);
    sidewalk.receiveShadow = true;
    this.scene.add(sidewalk);

    // “rua” mais escura em frente
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x55585f,
      roughness: 0.95,
      metalness: 0.04,
    });
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(this.WAREHOUSE_WIDTH + 260, 260),
      roadMat,
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.03, 220);
    road.receiveShadow = true;
    this.scene.add(road);

    // marcas de estacionamento / cais de carga
    const markMat = new THREE.MeshStandardMaterial({
      color: 0xf4f6f8,
      roughness: 0.7,
      metalness: 0.0,
      emissive: new THREE.Color(0xfdfdfd),
      emissiveIntensity: 0.25,
    });

    const slotWidth = 26;
    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue;
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(slotWidth, 0.5, 4),
        markMat,
      );
      mark.position.set(i * (slotWidth + 8), 0.6, 190);
      this.scene.add(mark);
    }
  }

  // --------------------------------------------------
  // ARMAZÉM (alta resolução)
  // --------------------------------------------------

  private addWarehouse(): void {
    const w = this.WAREHOUSE_WIDTH;
    const d = this.WAREHOUSE_DEPTH;
    const h = this.WAREHOUSE_HEIGHT;

    const warehouse = this.createWarehouseModule(w, d, h);
    warehouse.position.set(0, 0, 0);
    this.scene.add(warehouse);
  }

  private createWarehouseModule(
    w: number,
    d: number,
    h: number,
  ): THREE.Group {
    const group = new THREE.Group();

    // ---------------- BASE / FUNDAÇÃO ----------------
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x9fa1a5,
      roughness: 0.85,
    });
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w + 40, 6, d + 40),
      baseMat,
    );
    base.position.y = 3;
    base.receiveShadow = true;
    group.add(base);

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xbdbfc3,
      roughness: 0.8,
    });
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 30, 4, d + 30),
      plinthMat,
    );
    plinth.position.y = 6;
    plinth.receiveShadow = true;
    group.add(plinth);

    // ---------------- PAREDES ----------------
    const wallGroup = new THREE.Group();

    const concreteBaseMat = new THREE.MeshStandardMaterial({
      color: 0xd7d8db,
      roughness: 0.85,
      metalness: 0.05,
    });

    const metalWallMat = new THREE.MeshStandardMaterial({
      color: 0xc4c7cb,
      roughness: 0.6,
      metalness: 0.45,
    });

    const concreteHeight = 10;
    const metalHeight = h - concreteHeight;

    // faixa de betão inferior
    const concrete = new THREE.Mesh(
      new THREE.BoxGeometry(w, concreteHeight, d),
      concreteBaseMat,
    );
    concrete.position.y = 6 + concreteHeight / 2;
    wallGroup.add(concrete);

    // corpo metálico superior
    const metal = new THREE.Mesh(
      new THREE.BoxGeometry(w, metalHeight, d),
      metalWallMat,
    );
    metal.position.y = 6 + concreteHeight + metalHeight / 2;
    wallGroup.add(metal);

    // painéis verticais salientes na frente
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xaeb1b6,
      roughness: 0.4,
      metalness: 0.6,
    });

    for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 3.2) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, metalHeight * 0.95, 1.2),
        panelMat,
      );
      panel.position.set(
        x,
        6 + concreteHeight + metalHeight / 2,
        d / 2 + 0.7,
      );
      panel.castShadow = true;
      wallGroup.add(panel);
    }

    // cantos reforçados
    const cornerMat = new THREE.MeshStandardMaterial({
      color: 0x64686d,
      roughness: 0.45,
      metalness: 0.4,
    });

    const cornerGeom = new THREE.BoxGeometry(4, h + 4, 4);
    const corner1 = new THREE.Mesh(cornerGeom, cornerMat);
    corner1.position.set(-w / 2 - 2, 6 + h / 2, d / 2 - 2);
    const corner2 = corner1.clone();
    corner2.position.x = w / 2 + 2;
    const corner3 = corner1.clone();
    corner3.position.z = -d / 2 + 2;
    const corner4 = corner2.clone();
    corner4.position.z = -d / 2 + 2;

    wallGroup.add(corner1, corner2, corner3, corner4);

    group.add(wallGroup);

    // ---------------- TELHADO ----------------

    const roofGroup = new THREE.Group();

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x595c61,
      roughness: 0.45,
      metalness: 0.55,
    });

    const roofThickness = 3;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 10, roofThickness, d + 18),
      roofMat,
    );
    const roofHeight = 6 + h + 6;
    roof.position.y = roofHeight;
    roof.rotation.x = THREE.MathUtils.degToRad(11);
    roof.castShadow = true;
    roof.receiveShadow = true;
    roofGroup.add(roof);

    // beiral frontal
    const eaveGeom = new THREE.BoxGeometry(w + 12, 2, 4);
    const eaveMat = new THREE.MeshStandardMaterial({
      color: 0x4b4e52,
      metalness: 0.6,
      roughness: 0.35,
    });
    const eave = new THREE.Mesh(eaveGeom, eaveMat);
    eave.position.set(0, roofHeight + 1, d / 2 + 6);
    eave.castShadow = true;
    roofGroup.add(eave);

    // claraboias
    const skylightMat = new THREE.MeshStandardMaterial({
      color: 0xaed4ff,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.7,
    });

    const skylightGeom = new THREE.BoxGeometry(18, 1, 6);
    for (let i = -2; i <= 2; i += 2) {
      const sky = new THREE.Mesh(skylightGeom, skylightMat);
      sky.position.set(i * 22, roofHeight + 2, -d / 6);
      sky.rotation.x = THREE.MathUtils.degToRad(11);
      sky.castShadow = true;
      roofGroup.add(sky);
    }

    // caleiras laterais
    const gutterMat = new THREE.MeshStandardMaterial({
      color: 0x3f4246,
      metalness: 0.65,
      roughness: 0.3,
    });

    const gutterGeom = new THREE.BoxGeometry(2, 2, d + 12);
    const gutterLeft = new THREE.Mesh(gutterGeom, gutterMat);
    gutterLeft.position.set(-w / 2 - 5, roofHeight - 1, 0);
    const gutterRight = gutterLeft.clone();
    gutterRight.position.x = w / 2 + 5;
    roofGroup.add(gutterLeft, gutterRight);

    // tubos de queda
    const pipeGeom = new THREE.CylinderGeometry(0.9, 0.9, h, 8);
    const pipe1 = new THREE.Mesh(pipeGeom, gutterMat);
    pipe1.position.set(-w / 2 - 5, 6 + h / 2, d / 2 - 6);
    const pipe2 = pipe1.clone();
    pipe2.position.x = w / 2 + 5;

    roofGroup.add(pipe1, pipe2);

    group.add(roofGroup);

    // ---------------- DETALHES FINAIS ----------------

    return group;
  }

  // --------------------------------------------------
  // LOOP DE ANIMAÇÃO
  // --------------------------------------------------

  private startAnimationLoop = () => {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.startAnimationLoop);
  };
}
