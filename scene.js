import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.getElementById('scene');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = Math.min(window.innerWidth, window.innerHeight) < 640;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  // Sem WebGL: a página continua legível sobre o fundo escuro.
  throw e;
}
const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setClearColor(0x04050a, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(0, 0, 10);

const COLOR_A = new THREE.Color(0x7dd3fc);
const COLOR_B = new THREE.Color(0xa78bfa);
const COLOR_C = new THREE.Color(0xf0abfc);

const world = new THREE.Group();
scene.add(world);

/* ------------------------------------------------------------------ */
/* Esfera de partículas com deslocamento por ruído simplex (GPU)      */
/* ------------------------------------------------------------------ */
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
   +i.y+vec4(0.0,i1.y,i2.y,1.0))
   +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const COUNT = small ? 6000 : 12000;
const RADIUS = 2.7;
const positions = new Float32Array(COUNT * 3);
const scatter = new Float32Array(COUNT * 3);
const rand = new Float32Array(COUNT);
const golden = Math.PI * (3 - Math.sqrt(5));
const tmp = new THREE.Vector3();

for (let i = 0; i < COUNT; i++) {
  const y = 1 - (i / (COUNT - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const t = golden * i;
  positions.set([Math.cos(t) * r, y, Math.sin(t) * r], i * 3);
  tmp.randomDirection().multiplyScalar(9 + Math.random() * 10);
  scatter.set([tmp.x, tmp.y, tmp.z], i * 3);
  rand[i] = Math.random();
}

const sphereGeo = new THREE.BufferGeometry();
sphereGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
sphereGeo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
sphereGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

const uniforms = {
  uTime: { value: 0 },
  uIntro: { value: reduceMotion ? 1 : 0 },
  uMouse: { value: new THREE.Vector3(99, 99, 99) },
  uHover: { value: 0 },
  uRadius: { value: RADIUS },
  uSize: { value: (small ? 34 : 30) * pixelRatio },
  uColorA: { value: COLOR_A },
  uColorB: { value: COLOR_B },
  uColorC: { value: COLOR_C },
};

const sphereMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uIntro, uHover, uRadius, uSize;
    uniform vec3 uMouse;
    attribute vec3 aScatter;
    attribute float aRand;
    varying float vNoise, vAlpha;
    ${NOISE}
    void main() {
      vec3 dir = position;
      float n  = snoise(dir * 1.25 + vec3(0.0, uTime * 0.22, uTime * 0.05));
      float n2 = snoise(dir * 3.2 - uTime * 0.12) * 0.35;
      vec3 target = dir * (uRadius + (n + n2) * 0.32);

      // intro: partículas convergem de uma nuvem dispersa
      float k = clamp(uIntro * 1.5 - aRand * 0.5, 0.0, 1.0);
      k = 1.0 - pow(1.0 - k, 3.0);
      vec3 p = mix(aScatter, target, k);

      vec4 wp = modelMatrix * vec4(p, 1.0);

      // repulsão em torno do cursor
      vec3 d = wp.xyz - uMouse;
      float infl = smoothstep(1.8, 0.0, length(d)) * uHover;
      wp.xyz += normalize(d + 1e-5) * infl * 0.75;

      vec4 mv = viewMatrix * wp;
      gl_Position = projectionMatrix * mv;

      float depth = smoothstep(-13.0, -7.3, mv.z);           // frente mais brilhante
      float twinkle = 0.65 + 0.35 * sin(uTime * 1.7 + aRand * 40.0);
      vNoise = n;
      vAlpha = 0.8 * twinkle * (0.12 + 0.88 * depth) * (0.4 + 0.6 * smoothstep(-0.8, 0.9, n)) * (0.3 + 0.7 * k);
      gl_PointSize = uSize * (0.5 + aRand * 0.9) * (1.0 + infl * 1.4) / -mv.z;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColorA, uColorB, uColorC;
    varying float vNoise, vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = pow(1.0 - d * 2.0, 1.7);
      vec3 col = mix(uColorA, uColorB, smoothstep(-0.55, 0.45, vNoise));
      col = mix(col, uColorC, smoothstep(0.45, 0.95, vNoise) * 0.7);
      gl_FragColor = vec4(col, a * vAlpha);
    }`,
});

const sphere = new THREE.Points(sphereGeo, sphereMat);
sphere.frustumCulled = false;
world.add(sphere);

/* ------------------------------------------------------------------ */
/* Núcleo geométrico                                                   */
/* ------------------------------------------------------------------ */
const core = new THREE.Group();
const coreOuter = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.05, 1)),
  new THREE.LineBasicMaterial({ color: COLOR_A, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })
);
const coreInner = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.5, 0)),
  new THREE.LineBasicMaterial({ color: COLOR_B, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
);
const coreGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
core.add(coreOuter, coreInner, coreGlow);
world.add(core);

/* ------------------------------------------------------------------ */
/* Órbitas tracejadas + satélites                                      */
/* ------------------------------------------------------------------ */
function makeOrbit(radius, tilt, color, speed, phase) {
  const pivot = new THREE.Group();
  pivot.rotation.set(tilt[0], tilt[1], tilt[2]);

  const pts = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2).getPoints(256);
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.11, transparent: true, opacity: 0.4, depthWrite: false })
  );
  line.computeLineDistances();
  pivot.add(line);

  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), new THREE.MeshBasicMaterial({ color }));
  pivot.add(sat);
  world.add(pivot);
  return { pivot, sat, radius, speed, phase };
}

const orbits = [
  makeOrbit(3.75, [1.25, 0.15, 0], COLOR_A, 0.5, 0),
  makeOrbit(4.35, [0.35, 0.9, 0.2], COLOR_B, -0.34, 2),
  makeOrbit(5.0, [-0.6, -0.5, 0.4], COLOR_C, 0.22, 4),
];

/* ------------------------------------------------------------------ */
/* Campo de estrelas                                                   */
/* ------------------------------------------------------------------ */
const STARS = small ? 900 : 1800;
const starPos = new Float32Array(STARS * 3);
for (let i = 0; i < STARS; i++) {
  tmp.randomDirection().multiplyScalar(25 + Math.random() * 45);
  starPos.set([tmp.x, tmp.y, tmp.z], i * 3);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0x9aa4bf, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false,
}));
scene.add(stars);

/* ------------------------------------------------------------------ */
/* Pós-processamento (bloom)                                           */
/* ------------------------------------------------------------------ */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.35, 0.12);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------ */
/* Interação                                                           */
/* ------------------------------------------------------------------ */
const pointer = new THREE.Vector2(0, 0);
const parallax = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -1.2);
const hit = new THREE.Vector3();
let hoverTarget = 0;

window.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  hoverTarget = 1;
}, { passive: true });
document.addEventListener('pointerleave', () => { hoverTarget = 0; });
window.addEventListener('blur', () => { hoverTarget = 0; });

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const aspect = w / h;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = aspect;
  // garante que a cena caiba em telas estreitas (retrato)
  const halfWidthNeeded = 4.4;
  const zFit = halfWidthNeeded / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
  camera.userData.baseZ = Math.max(10, zFit);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
camera.position.z = camera.userData.baseZ;

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let time = 0;

function update(dt) {
  time += dt;
  uniforms.uTime.value = time;
  if (uniforms.uIntro.value < 1) uniforms.uIntro.value = Math.min(1, uniforms.uIntro.value + dt / 3.2);

  parallax.lerp(pointer, 0.035);
  uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * 0.05;

  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(plane, hit)) uniforms.uMouse.value.copy(hit);

  world.rotation.y = time * 0.07 + parallax.x * 0.35;
  world.rotation.x = Math.sin(time * 0.15) * 0.1 - parallax.y * 0.2;

  coreOuter.rotation.set(time * 0.21, time * 0.33, 0);
  coreInner.rotation.set(-time * 0.5, -time * 0.27, time * 0.2);
  const pulse = 1 + Math.sin(time * 1.6) * 0.06;
  core.scale.setScalar(pulse * Math.min(1, uniforms.uIntro.value * 1.3));

  for (const o of orbits) {
    const a = time * o.speed + o.phase;
    o.sat.position.set(Math.cos(a) * o.radius, Math.sin(a) * o.radius, 0);
    o.pivot.rotation.z += dt * o.speed * 0.05;
  }

  stars.rotation.y = time * 0.004;
  stars.rotation.x = time * 0.002;

  camera.position.x += (parallax.x * 0.8 - camera.position.x) * 0.04;
  camera.position.y += (parallax.y * 0.5 - camera.position.y) * 0.04;
  camera.position.z += (camera.userData.baseZ - camera.position.z) * 0.04;
  camera.lookAt(0, 0, 0);
}

function frame() {
  update(Math.min(clock.getDelta(), 1 / 20));
  composer.render();
  requestAnimationFrame(frame);
}

if (reduceMotion) {
  update(0);
  time = 6;
  update(0);
  composer.render();
  window.addEventListener('resize', () => composer.render());
} else {
  requestAnimationFrame(frame);
}

requestAnimationFrame(() => canvas.classList.add('ready'));
