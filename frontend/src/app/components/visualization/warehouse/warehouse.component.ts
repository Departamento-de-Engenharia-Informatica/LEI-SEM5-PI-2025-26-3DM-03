import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  private gltfLoader = new GLTFLoader();
  private readonly warehouseModelUrl = 'assets/models/warehouse.glb';
  private warehouseRoot?: THREE.Group;

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
    this.gltfLoader.load(
      this.warehouseModelUrl,
      (gltf) => {
        this.warehouseRoot = gltf.scene;
        this.prepareWarehouseModel(this.warehouseRoot);
        this.scene.add(this.warehouseRoot);
      },
      undefined,
      (error) => {
        console.error('[WarehouseComponent] Falha ao carregar warehouse.glb', error);
      }
    );
  }

  private prepareWarehouseModel(model: THREE.Group): void {
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((mat) => (mat.envMapIntensity = 1));
        } else if (material) {
          (material as THREE.MeshStandardMaterial).envMapIntensity = 1;
        }
      }
    });

    const initialBox = new THREE.Box3().setFromObject(model);
    const size = initialBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSpan = 360;
    const scale = targetSpan / maxDim;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const finalBox = new THREE.Box3().setFromObject(model);
    const center = finalBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -finalBox.min.y + 4, -center.z);
  }

  // --------------------------------------------------
  // LOOP DE ANIMAÇÃO
  // --------------------------------------------------

  private startAnimationLoop = () => {
    if (this.warehouseRoot) {
      this.warehouseRoot.rotation.y += 0.0008;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.startAnimationLoop);
  };
}
