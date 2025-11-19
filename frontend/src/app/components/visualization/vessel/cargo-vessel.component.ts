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
  selector: 'app-cargo-vessel',
  standalone: true,
  templateUrl: './cargo-vessel.component.html',
  styleUrls: ['./cargo-vessel.component.scss'],
})
export class CargoVesselComponent implements AfterViewInit, OnDestroy {
  @ViewChild('vesselCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId: number | null = null;
  private gltfLoader = new GLTFLoader();
  private readonly modelUrl = 'assets/models/cargo_vessel.glb';
  private vesselRoot?: THREE.Group;
  private wavePhase = 0;
  private ocean?: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  ngAfterViewInit(): void {
    this.initScene();
    this.addEnvironment();
    this.loadVesselModel();
    this.startAnimationLoop();
    window.addEventListener('resize', this.onWindowResize);
  }

  ngOnDestroy(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.controls?.dispose();
    this.renderer?.dispose();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xa7c8f1);
    this.scene.fog = new THREE.Fog(0xa7c8f1, 300, 2200);

    const width = this.canvas.clientWidth || 1024;
    const height = this.canvas.clientHeight || 576;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 6000);
    this.camera.position.set(520, 240, 520);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    (this.renderer as any).outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 950;
    this.controls.target.set(0, 30, 0);
    this.controls.update();
  }

  private onWindowResize = () => {
    const width = this.canvas.clientWidth || 1024;
    const height = this.canvas.clientHeight || 576;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private addEnvironment(): void {
    const hemi = new THREE.HemisphereLight(0xfefefe, 0x1b3c60, 0.7);
    hemi.position.set(0, 800, 0);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(600, 600, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 2000;
    sun.shadow.camera.left = -900;
    sun.shadow.camera.right = 900;
    sun.shadow.camera.top = 900;
    sun.shadow.camera.bottom = -900;
    const fill = new THREE.DirectionalLight(0xb3d4ff, 0.45);
    fill.position.set(-400, 200, -500);
    this.scene.add(hemi, sun, fill);

    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x1f6fa3) },
    };
    const oceanMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.z += sin((pos.x + uTime) * 0.02) * 4.0;
          pos.z += cos((pos.y - uTime) * 0.015) * 3.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float stripe = smoothstep(0.0, 1.0, sin(vUv.x * 40.0) * 0.5 + 0.5);
          vec3 color = mix(uColor * 0.8, uColor, stripe);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: false,
    });
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000, 256, 256),
      oceanMat,
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -8;
    ocean.receiveShadow = true;
    this.scene.add(ocean);
    this.ocean = ocean;
  }

  private loadVesselModel(): void {
    this.gltfLoader.load(
      this.modelUrl,
      (gltf) => {
        this.vesselRoot = gltf.scene;
        this.prepareVessel(this.vesselRoot);
        this.scene.add(this.vesselRoot);
      },
      undefined,
      (error) => {
        console.error('[CargoVesselComponent] Falha ao carregar cargo_vessel.glb', error);
      }
    );
  }

  private prepareVessel(model: THREE.Group): void {
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const material = child.material;
        if (Array.isArray(material)) {
          material.forEach((mat) => (mat.envMapIntensity = 1.1));
        } else if (material) {
          (material as THREE.MeshStandardMaterial).envMapIntensity = 1.1;
        }
      }
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetLength = 420;
    const scale = targetLength / maxDim;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -scaledBox.min.y + 12, -center.z);
  }

  private startAnimationLoop(): void {
    const render = () => {
      this.animationId = requestAnimationFrame(render);
      this.wavePhase += 0.5;
      if (this.ocean) {
        (this.ocean.material as THREE.ShaderMaterial).uniforms['uTime'].value = this.wavePhase;
      }
      if (this.vesselRoot) {
        this.vesselRoot.rotation.y += 0.0009;
        this.vesselRoot.position.y = Math.sin(this.wavePhase * 0.01) * 2 + 6;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }
}
