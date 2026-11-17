import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export interface RoomTextureSet {
  floorMap: THREE.CanvasTexture;
  floorRoughMap: THREE.CanvasTexture;
  floorBumpMap: THREE.CanvasTexture;
  hallFloorMap: THREE.CanvasTexture;
  wallMap: THREE.CanvasTexture;
  wallBumpMap: THREE.CanvasTexture;
  mahoganyMap: THREE.CanvasTexture;
  mahoganyRoughMap: THREE.CanvasTexture;
  mattressMap: THREE.CanvasTexture;
  mattressBumpMap: THREE.CanvasTexture;
  blueSheetMap: THREE.CanvasTexture;
  plaidClothMap: THREE.CanvasTexture;
  plaidPillowMap: THREE.CanvasTexture;
  bolsterMap: THREE.CanvasTexture;
  orangeCurtainMap: THREE.CanvasTexture;
  peachCurtainMap: THREE.CanvasTexture;
  mustardCurtainMap: THREE.CanvasTexture;
  leafMap: THREE.CanvasTexture;
  contactShadowTex: THREE.CanvasTexture;
  dispose: () => void;
}

export function createRoomTextures(maxAnisotropy: number): RoomTextureSet {
  const aniso = Math.max(1, maxAnisotropy);
  const allTextures: THREE.CanvasTexture[] = [];
  const reg = (t: THREE.CanvasTexture) => {
    allTextures.push(t);
    return t;
  };

  // 1. Warm beige-cream ceramic square floor tiles (matching video 00:00, 00:15-00:21)
  const [tileC, tileCtx] = makeCanvas(512, 512);
  const [tileRC, tileRCtx] = makeCanvas(512, 512);
  const [tileBC, tileBCtx] = makeCanvas(512, 512);

  tileCtx.fillStyle = '#b4aa99';
  tileCtx.fillRect(0, 0, 512, 512);
  tileRCtx.fillStyle = '#525252';
  tileRCtx.fillRect(0, 0, 512, 512);
  tileBCtx.fillStyle = '#dcdcdc';
  tileBCtx.fillRect(0, 0, 512, 512);

  // Subtle horizontal stone/ceramic marbling streaks
  for (let i = 0; i < 200; i++) {
    const y = Math.random() * 512;
    const x = Math.random() * 512;
    const w = 32 + Math.random() * 140;
    const h = 2 + Math.random() * 7;
    tileCtx.fillStyle = i % 2 === 0 ? 'rgba(138, 126, 108, 0.28)' : 'rgba(202, 194, 180, 0.22)';
    tileCtx.fillRect(x, y, w, h);
    tileRCtx.fillStyle = i % 2 === 0 ? 'rgba(110, 110, 110, 0.2)' : 'rgba(56, 56, 56, 0.2)';
    tileRCtx.fillRect(x, y, w, h);
  }

  // Tile grout lines (2x2 tiles per texture tile)
  const drawGrout = (ctx: CanvasRenderingContext2D, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (const p of [0, 256, 512]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(512, p);
      ctx.stroke();
    }
  };
  drawGrout(tileCtx, '#433b32', 5);
  drawGrout(tileRCtx, '#dedede', 6);
  drawGrout(tileBCtx, '#2a2a2a', 6);

  const floorMap = reg(finalizeTexture(tileC, true, aniso, 4.2, 4.7));
  const floorRoughMap = reg(finalizeTexture(tileRC, false, aniso, 4.2, 4.7));
  const floorBumpMap = reg(finalizeTexture(tileBC, false, aniso, 4.2, 4.7));

  // 2. Terracotta hallway ceramic tiles (matching 00:11, 00:44)
  const [hallC, hallCtx] = makeCanvas(256, 256);
  hallCtx.fillStyle = '#a86451';
  hallCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    hallCtx.fillStyle = i % 2 === 0 ? 'rgba(132, 68, 52, 0.25)' : 'rgba(196, 128, 108, 0.16)';
    hallCtx.fillRect(Math.random() * 256, Math.random() * 256, 24 + Math.random() * 60, 3 + Math.random() * 8);
  }
  hallCtx.strokeStyle = '#472d26';
  hallCtx.lineWidth = 4;
  for (const p of [0, 128, 256]) {
    hallCtx.beginPath();
    hallCtx.moveTo(p, 0);
    hallCtx.lineTo(p, 256);
    hallCtx.stroke();
    hallCtx.beginPath();
    hallCtx.moveTo(0, p);
    hallCtx.lineTo(256, p);
    hallCtx.stroke();
  }
  const hallFloorMap = reg(finalizeTexture(hallC, true, aniso, 2.5, 3.0));

  // 3. Olive-moss painted plaster wall (matching video 00:01-00:12, 00:34-00:47)
  const [wallC, wallCtx] = makeCanvas(512, 512);
  const [wallBC, wallBCtx] = makeCanvas(512, 512);
  wallCtx.fillStyle = '#6c744c';
  wallCtx.fillRect(0, 0, 512, 512);
  wallBCtx.fillStyle = '#808080';
  wallBCtx.fillRect(0, 0, 512, 512);

  // Subtle vertical plaster/paint variation & roller texture
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 6;
    wallCtx.fillStyle = i % 3 === 0 ? 'rgba(82, 90, 56, 0.16)' : 'rgba(124, 132, 92, 0.11)';
    wallCtx.fillRect(x, y, r, r);
    wallBCtx.fillStyle = i % 2 === 0 ? 'rgba(165, 165, 165, 0.25)' : 'rgba(95, 95, 95, 0.25)';
    wallBCtx.fillRect(x, y, r * 0.7, r * 0.7);
  }
  // Subtle seamless damp/age blotches matching real bedroom plaster
  for (let i = 0; i < 20; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const gr = 24 + Math.random() * 44;
    for (const ox of [-512, 0, 512]) {
      for (const oy of [-512, 0, 512]) {
        const cx = gx + ox;
        const cy = gy + oy;
        if (cx + gr < 0 || cx - gr > 512 || cy + gr < 0 || cy - gr > 512) continue;
        const g = wallCtx.createRadialGradient(cx, cy, 2, cx, cy, gr);
        g.addColorStop(0, 'rgba(66, 72, 44, 0.14)');
        g.addColorStop(1, 'rgba(66, 72, 44, 0)');
        wallCtx.fillStyle = g;
        wallCtx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
      }
    }
  }
  const wallMap = reg(finalizeTexture(wallC, true, aniso, 2, 2));
  const wallBumpMap = reg(finalizeTexture(wallBC, false, aniso, 3, 3));

  // 4. Glossy reddish-mahogany wood (wardrobe & doorframe, 00:08, 00:25-00:33)
  const [woodC, woodCtx] = makeCanvas(512, 512);
  const [woodRC, woodRCtx] = makeCanvas(512, 512);
  woodCtx.fillStyle = '#5c1f13';
  woodCtx.fillRect(0, 0, 512, 512);
  woodRCtx.fillStyle = '#484848';
  woodRCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * 512;
    const w = 1 + Math.random() * 4;
    woodCtx.fillStyle = i % 2 === 0 ? 'rgba(42, 11, 5, 0.38)' : 'rgba(124, 44, 24, 0.25)';
    woodCtx.fillRect(x, 0, w, 512);
    woodRCtx.fillStyle = i % 2 === 0 ? 'rgba(85, 85, 85, 0.2)' : 'rgba(40, 40, 40, 0.2)';
    woodRCtx.fillRect(x, 0, w, 512);
  }
  const mahoganyMap = reg(finalizeTexture(woodC, true, aniso, 1, 1));
  const mahoganyRoughMap = reg(finalizeTexture(woodRC, false, aniso, 1, 1));

  // 5. Quilted cream-taupe mattress top (00:00, 00:01)
  const [matC, matCtx] = makeCanvas(256, 256);
  const [matBC, matBCtx] = makeCanvas(256, 256);
  matCtx.fillStyle = '#b9b0a2';
  matCtx.fillRect(0, 0, 256, 256);
  matBCtx.fillStyle = '#d0d0d0';
  matBCtx.fillRect(0, 0, 256, 256);
  matCtx.strokeStyle = 'rgba(128, 118, 106, 0.45)';
  matCtx.lineWidth = 2;
  matBCtx.strokeStyle = '#606060';
  matBCtx.lineWidth = 3;
  for (let i = -256; i < 512; i += 32) {
    for (const ctx of [matCtx, matBCtx]) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  }
  const mattressMap = reg(finalizeTexture(matC, true, aniso, 3, 2));
  const mattressBumpMap = reg(finalizeTexture(matBC, false, aniso, 3, 2));

  // 6. Blue/cyan swirled patterned bedsheet (00:00, 00:38)
  const [sheetC, sheetCtx] = makeCanvas(256, 256);
  sheetCtx.fillStyle = '#3b73a8';
  sheetCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 64; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 8 + Math.random() * 20;
    sheetCtx.fillStyle = i % 3 === 0 ? 'rgba(182, 214, 236, 0.55)' : i % 3 === 1 ? 'rgba(20, 56, 104, 0.48)' : 'rgba(84, 152, 198, 0.5)';
    sheetCtx.beginPath();
    sheetCtx.arc(x, y, r, 0, Math.PI * 2);
    sheetCtx.fill();
  }
  const blueSheetMap = reg(finalizeTexture(sheetC, true, aniso, 2, 2));

  // 7. Plaid cloth (clothes pile on wardrobe stool) & Plaid pillow (headboard)
  const drawPlaid = (bg: string, c1: string, c2: string) => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = c1;
    for (let i = 0; i < 128; i += 24) {
      ctx.fillRect(i, 0, 8, 128);
      ctx.fillRect(0, i, 128, 8);
    }
    ctx.fillStyle = c2;
    for (let i = 12; i < 128; i += 24) {
      ctx.fillRect(i, 0, 4, 128);
      ctx.fillRect(0, i, 128, 4);
    }
    return c;
  };
  const plaidClothMap = reg(finalizeTexture(drawPlaid('#4e202c', 'rgba(38, 84, 48, 0.6)', 'rgba(196, 84, 118, 0.5)'), true, aniso, 2, 2));
  const plaidPillowMap = reg(finalizeTexture(drawPlaid('#9aa9b8', 'rgba(62, 98, 132, 0.48)', 'rgba(186, 114, 124, 0.44)'), true, aniso, 2, 2));

  // 7b. Dark-brown floral/polka bolster pattern on folding chair (00:07, 00:41)
  const [bolC, bolCtx] = makeCanvas(128, 128);
  bolCtx.fillStyle = '#2d1c19';
  bolCtx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 18; i++) {
    bolCtx.fillStyle = i % 2 === 0 ? 'rgba(218, 212, 204, 0.78)' : 'rgba(176, 168, 158, 0.55)';
    bolCtx.beginPath();
    bolCtx.arc((i * 37) % 128, (i * 53) % 128, 7 + (i % 3) * 3, 0, Math.PI * 2);
    bolCtx.fill();
  }
  const bolsterMap = reg(finalizeTexture(bolC, true, aniso, 2, 2));

  // 8. East Burnt-Orange Grommet Curtain (with iconic bottom eyelet band from 00:07, 00:23!)
  const [ocC, ocCtx] = makeCanvas(256, 256);
  ocCtx.fillStyle = '#cf431b';
  ocCtx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 4) {
    ocCtx.fillStyle = x % 8 === 0 ? 'rgba(245, 115, 65, 0.16)' : 'rgba(98, 22, 6, 0.18)';
    ocCtx.fillRect(x, 0, 2, 256);
  }
  ocCtx.fillStyle = 'rgba(245, 132, 76, 0.35)';
  ocCtx.fillRect(0, 178, 256, 32);
  for (let x = 18; x < 256; x += 32) {
    ocCtx.fillStyle = '#f2d9c8';
    ocCtx.beginPath();
    ocCtx.arc(x, 194, 7, 0, Math.PI * 2);
    ocCtx.fill();
    ocCtx.fillStyle = '#9e2e0f';
    ocCtx.beginPath();
    ocCtx.arc(x, 194, 4, 0, Math.PI * 2);
    ocCtx.fill();
  }
  const orangeCurtainMap = reg(finalizeTexture(ocC, true, aniso, 1, 1));

  // 9. Peach sheer curtain (North bed window) & Mustard knotted doorway curtain
  const makeFabric = (base: string, stripe1: string, stripe2: string) => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? stripe1 : stripe2;
      ctx.fillRect(x, 0, 2, 128);
    }
    return c;
  };
  const peachCurtainMap = reg(
    finalizeTexture(makeFabric('#d27d62', 'rgba(240, 175, 148, 0.2)', 'rgba(155, 68, 44, 0.18)'), true, aniso, 1, 1),
  );
  const mustardCurtainMap = reg(
    finalizeTexture(makeFabric('#b07d28', 'rgba(216, 176, 82, 0.18)', 'rgba(112, 72, 16, 0.22)'), true, aniso, 1, 1),
  );

  // 10. Tropical banana leaf texture (outside windows)
  const [leafC, leafCtx] = makeCanvas(128, 256);
  leafCtx.fillStyle = '#447d2a';
  leafCtx.fillRect(0, 0, 128, 256);
  leafCtx.fillStyle = '#68a43e';
  leafCtx.fillRect(60, 0, 8, 256);
  leafCtx.strokeStyle = 'rgba(145, 196, 78, 0.45)';
  leafCtx.lineWidth = 2;
  for (let y = 12; y < 250; y += 16) {
    leafCtx.beginPath();
    leafCtx.moveTo(64, y);
    leafCtx.lineTo(8, y - 10);
    leafCtx.moveTo(64, y);
    leafCtx.lineTo(120, y - 10);
    leafCtx.stroke();
  }
  const leafMap = reg(finalizeTexture(leafC, true, aniso, 1, 1));

  // 11. Soft radial contact shadow decal (grounds furniture & props without white washout)
  const [shC, shCtx] = makeCanvas(128, 128);
  const grad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(10, 12, 8, 0.72)');
  grad.addColorStop(0.55, 'rgba(12, 14, 10, 0.34)');
  grad.addColorStop(1, 'rgba(12, 14, 10, 0.0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowTex = reg(finalizeTexture(shC, true, aniso, 1, 1));
  contactShadowTex.wrapS = THREE.ClampToEdgeWrapping;
  contactShadowTex.wrapT = THREE.ClampToEdgeWrapping;

  return {
    floorMap,
    floorRoughMap,
    floorBumpMap,
    hallFloorMap,
    wallMap,
    wallBumpMap,
    mahoganyMap,
    mahoganyRoughMap,
    mattressMap,
    mattressBumpMap,
    blueSheetMap,
    plaidClothMap,
    plaidPillowMap,
    bolsterMap,
    orangeCurtainMap,
    peachCurtainMap,
    mustardCurtainMap,
    leafMap,
    contactShadowTex,
    dispose: () => {
      for (const t of allTextures) t.dispose();
    },
  };
}
