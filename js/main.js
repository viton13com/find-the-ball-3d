import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LEVELS, DURATION, levelAt, cupXZ, cupY, slotX, UP, BALL_R, clamp, lerp, smooth, ease, easeOut } from './timeline.js';

const Q = new URLSearchParams(location.search), LANG = (Q.get('lang') || (navigator.language?.startsWith('ru') ? 'ru' : 'en')) === 'en' ? 'en' : 'ru', PR = +(Q.get('pr') || 1);
const TX = {
  ru: { title: 'Найди<br><span class="r">шарик</span>', sub: '3 уровня. Дойдёшь до конца?', lv: ['Уровень 1 · Лёгкий', 'Уровень 2 · Средний', 'Уровень 3 · Сложный'],
    follow: { red: 'Следи за <span class="r">красным</span>', blue: 'Следи за <span class="b">синим</span>' }, shuffle: 'Мешаем…',
    ask: { red: 'Найди <span class="r">красный</span> шарик', blue: 'Найди <span class="b">синий</span> шарик' }, askSub: 'В каком он стаканчике?',
    ans: (n) => `Ответ: ${n}`, ansSub: 'Угадал?', endH: 'Какой номер?', endP: 'Пиши ответ в комментариях' },
  en: { title: 'Find<br>the <span class="r">ball</span>', sub: '3 levels. Can you make it to the end?', lv: ['Level 1 · Easy', 'Level 2 · Medium', 'Level 3 · Hard'],
    follow: { red: 'Watch the <span class="r">red</span> one', blue: 'Watch the <span class="b">blue</span> one' }, shuffle: 'Shuffling…',
    ask: { red: 'Find the <span class="r">red</span> ball', blue: 'Find the <span class="b">blue</span> ball' }, askSub: 'Which cup is it under?',
    ans: (n) => `Answer: ${n}`, ansSub: 'Did you get it?', endH: 'Which number?', endP: 'Drop your answer in the comments' },
}[LANG];
const LVC = ['#34c759', '#ffb020', '#ff3b30'], COL = { red: '#ff3b30', blue: '#3d7bff' };

// ---------------- renderer / scene ----------------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(PR); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene(), BG = new THREE.Color('#08090d');
scene.background = BG; scene.fog = new THREE.Fog(BG, 16, 42);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 80);

// lights: a warm spot pool from above-front, cool rim from behind, faint fill
const spot = new THREE.SpotLight(0xfff0dc, 520, 0, 0.36, 0.9, 2);
spot.position.set(1.6, 13, 4.5); spot.target.position.set(0, 0, 0); spot.castShadow = true;
spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.camera.near = 4; spot.shadow.camera.far = 25; spot.shadow.radius = 4;
scene.add(spot, spot.target);
const rim = new THREE.DirectionalLight(0x8fb4ff, 1.3); rim.position.set(-3, 4, -7); scene.add(rim);
const fill = new THREE.HemisphereLight(0x9aa6c0, 0x1a1410, 0.16); scene.add(fill);

// floor
const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96), new THREE.MeshPhysicalMaterial({ color: '#121419', roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// cup: thick-walled tumbler turned upside down (lathe), with a thin orange band
const rAt = (y) => 0.53 - (0.53 - 0.405) * (y / 1.1);
const prof = [[0, 1.13], [0.36, 1.13], [0.395, 1.115], [0.408, 1.09], [rAt(0.5), 0.5], [0.527, 0.03], [0.52, 0], [0.486, 0], [0.48, 0.03], [rAt(0.5) - 0.042, 0.5], [0.37, 1.07], [0, 1.07]].map(([x, y]) => new THREE.Vector2(x, y));
const cupGeo = new THREE.LatheGeometry(prof, 96); cupGeo.computeVertexNormals();
const bandGeo = new THREE.LatheGeometry([new THREE.Vector2(rAt(0.80) + 0.004, 0.80), new THREE.Vector2(rAt(0.88) + 0.004, 0.88)], 96);
const cupMat = new THREE.MeshPhysicalMaterial({ color: '#efe8dc', roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, sheen: 0.2, side: THREE.DoubleSide });
const bandMat = new THREE.MeshPhysicalMaterial({ color: '#ff6a2a', roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide });
const cups = [...Array(5)].map(() => { const g = new THREE.Group(); const m = new THREE.Mesh(cupGeo, cupMat); m.castShadow = m.receiveShadow = true; const b = new THREE.Mesh(bandGeo, bandMat); b.castShadow = true; g.add(m, b); scene.add(g); return g; });

// balls
const ballGeo = new THREE.SphereGeometry(BALL_R, 64, 48);
const mkBall = (c) => { const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.3 })); m.castShadow = true; scene.add(m); return m; };
const balls = { red: mkBall('#e5241b'), blue: mkBall('#1f5fff') };

// glow rings on the floor
const ringGeo = new THREE.RingGeometry(0.62, 0.7, 96);
const mkRing = () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.004; scene.add(m); return m; };
const ringA = mkRing(), ringB = mkRing();

// ---------------- overlay ----------------
const $ = (s) => document.querySelector(s);
$('#title h1').innerHTML = TX.title; $('#title p').textContent = TX.sub; $('#end h2').textContent = TX.endH; $('#end p').textContent = TX.endP;
const nums = [...Array(5)].map((_, i) => { const d = document.createElement('div'); d.className = 'num'; d.textContent = i + 1; $('#nums').appendChild(d); return d; });
const show = (el, o, dy = 0, sc = 1) => { el.style.opacity = o.toFixed(3); el.style.transform = `translateY(${(dy * (1 - o)).toFixed(2)}vw) scale(${sc})`; };
const vis = (t, a, b, fi = 0.35, fo = 0.3) => smooth((t - a) / fi) * (1 - smooth((t - (b - fo)) / fo));
const setHTML = (el, h) => { if (el._h !== h) { el.innerHTML = h; el._h = h; } };
const v3 = new THREE.Vector3();
const toScreen = (x, y, z) => { v3.set(x, y, z).project(camera); return [(v3.x * 0.5 + 0.5) * 100, (-v3.y * 0.5 + 0.5) * 100]; };

// ---------------- seek ----------------
function seek(t) {
  const L = levelAt(t), P = LEVELS[L.i - 1];
  // camera
  const dist = P ? lerp(P.dist, L.dist, ease((t - L.tCard) / 1.3)) : L.dist;
  const el = THREE.MathUtils.degToRad(56 - 3 * smooth(t / 3)), az = Math.sin(t * 0.23) * 0.06;
  const shake = L.i === 2 && t > L.tShuf && t < L.tAsk ? 0.012 : 0;
  camera.position.set(Math.sin(az) * Math.cos(el) * dist + Math.sin(t * 31) * shake, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(0, 1.0, 0); camera.updateMatrixWorld();

  // cups
  const pos = [];
  cups.forEach((g, c) => {
    if (c >= L.n) { g.visible = false; return; }
    g.visible = true; const p = cupXZ(L, c, t), slot = Math.round(p.x / 1.25 + (L.n - 1) / 2), y = cupY(L, c, t, slot);
    g.position.set(p.x, y, p.z); g.rotation.set(0, 0, -p.dir * 0.075 * p.moving); pos[c] = p;
  });
  // balls ride under their cups
  for (const k of ['red', 'blue']) {
    const b = balls[k], c = L[k], p = pos[c];
    let s = easeOut((t - L.tCard - 1.0 - (k === 'blue' ? 0.16 : 0)) / 0.45); s = s * (1 + 0.18 * Math.sin(clamp((t - L.tCard - 1.0 - (k === 'blue' ? 0.16 : 0)) / 0.45) * Math.PI));
    if (L.reveal && t > L.tExit) s *= 1 - easeOut((t - L.tExit) / 0.4);
    b.visible = s > 0.001; b.scale.setScalar(Math.max(s, 0.001)); b.position.set(p.x, BALL_R * b.scale.x, p.z); b.rotation.set(t * 0.3, t * 0.2, 0);
  }
  // rings: target pulse while showing, answer glow on reveal
  const tgt = L.target, tc = COL[tgt], tp = pos[L.targetCup];
  const showO = vis(t, L.tShow + 0.1, L.tDrop + 0.35, 0.3, 0.3);
  ringA.material.color.set(tc); ringA.position.set(tp.x, 0.004, tp.z);
  ringA.material.opacity = showO * (0.55 + 0.45 * Math.sin(t * 7)); ringA.scale.setScalar(1 + 0.08 * Math.sin(t * 7));
  let revO = 0; if (L.reveal) revO = vis(t, L.tReveal + 0.5, L.tExit + 0.2, 0.3, 0.4);
  ringB.material.color.set(tc); ringB.position.set(tp.x, 0.004, tp.z); ringB.material.opacity = revO; ringB.scale.setScalar(1.05 + 0.15 * easeOut((t - L.tReveal - 0.5) / 0.6));

  renderer.render(scene, camera);

  // ---- overlay ----
  show($('#title'), vis(t, 0.12, 2.45, 0.45, 0.4), 6);
  const pillO = vis(t, L.i === 0 ? 2.25 : L.tCard + 0.15, L.t1 + 0.05, 0.35, 0.35);
  setHTML($('#pill em'), TX.lv[L.i]); $('#pill span').style.setProperty('--c', LVC[L.i]); show($('#pill'), pillO, 3);
  show($('#dots'), vis(t, 2.25, DURATION + 1, 0.35), 2);
  [...document.querySelectorAll('#dots u')].forEach((u, i) => { const M = LEVELS[i]; u.style.setProperty('--c', LVC[i]); u.style.transform = `scaleX(${clamp((t - M.tCard) / (M.t1 - M.tCard)).toFixed(3)})`; });
  // main message
  const msg = $('#msg'), sub = $('#sub2');
  const followO = vis(t, L.tShow - 0.1, L.tAsk + 0.05, 0.35, 0.3), askO = vis(t, L.tAsk, L.t1 + 0.05, 0.3, 0.35);
  if (askO > 0) { setHTML(msg, TX.ask[tgt]); show(msg, askO, 4); } else { setHTML(msg, TX.follow[tgt]); show(msg, followO, 4); }
  const shufO = vis(t, L.tShuf, L.tAsk, 0.25, 0.25), askSubO = vis(t, L.tAsk + 0.25, L.reveal ? L.tReveal + 0.3 : L.t1 + 0.05, 0.3, 0.3);
  if (askSubO > 0) { setHTML(sub, TX.askSub); show(sub, askSubO, 3); } else { setHTML(sub, TX.shuffle); show(sub, shufO * (0.75 + 0.25 * Math.sin(t * 9)), 3); }
  // numbers under cups
  const numO = vis(t, L.tAsk + 0.15, L.reveal ? L.tExit + 0.15 : L.t1 + 0.05, 0.3, 0.3);
  nums.forEach((d, i) => {
    if (i >= L.n) { d.style.opacity = 0; return; }
    const [x, y] = toScreen(slotX(L.n, i), 0, 0.95); d.style.left = x + '%'; d.style.top = y + '%';
    const win = L.reveal && t > L.tReveal + 0.5 && i + 1 === L.answer; d.classList.toggle('win', win); d.style.setProperty('--c', tc);
    const o = numO * (L.reveal && t > L.tReveal + 0.5 && !win ? 0.35 : 1);
    d.style.opacity = o.toFixed(3); d.style.transform = `scale(${(0.6 + 0.4 * easeOut((t - L.tAsk - 0.15 - i * 0.06) / 0.35)) * (win ? 1.12 : 1)})`;
  });
  // countdown 3-2-1
  const cO = vis(t, L.tAsk + 0.3, L.tAsk + 3.4, 0.25, 0.25), cp = clamp((t - L.tAsk - 0.4) / 3);
  show($('#count'), cO, 3); $('#arc').style.strokeDashoffset = (276.5 * cp).toFixed(1); $('#arc').style.stroke = LVC[L.i];
  setHTML($('#count .d'), String(Math.max(1, 3 - Math.floor(cp * 3))));
  // answer / end card
  const ansO = L.reveal ? vis(t, L.tReveal + 0.55, L.tExit + 0.2, 0.3, 0.3) : 0;
  setHTML($('#ans'), `${TX.ans(L.answer)}<small>${TX.ansSub}</small>`); show($('#ans'), ansO, 4, 0.9 + 0.1 * easeOut((t - L.tReveal - 0.55) / 0.4));
  show($('#end'), L.reveal ? 0 : vis(t, L.tEnd + 0.1, DURATION + 1, 0.4), 5);
  show($('#brand'), 0.9, 0);
}

window.DURATION = DURATION; window.LEVELS = LEVELS; window.seek = seek;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
seek(0); window.ready = true;
// plays in a loop in a normal browser (?play=0 holds the first frame); the headless renderer drives seek() itself
if (Q.get('play') === '1' || (!navigator.webdriver && Q.get('play') !== '0')) { const s = performance.now(); const loop = () => { seek(((performance.now() - s) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
console.log('LOG duration', DURATION.toFixed(2), 'answers', LEVELS.map((L) => L.answer).join(','));
