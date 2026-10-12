import * as THREE from "three";
import { CONFIG, STEP } from "../core/config";
import type { Track } from "../core/track";
import { clearOfRoad, newCluster, placeBuilding, type Cluster, type Placement } from "./buildingPlacement";
import { BUILDING_BASE } from "./environment";
import { biomeAt } from "./palette";

const COUNT = 140;
const BEHIND = 40;
const AHEAD = 280;
/** I nuovi edifici nascono in fondo, in [kartS + RESPAWN_FROM, kartS + AHEAD]. */
const RESPAWN_FROM = 200;
const PER_CLUSTER_MIN = 2, PER_CLUSTER_MAX = 5;

interface Slot { s: number; p: Placement | null }

/**
 * Città di blocchi: InstancedMesh di box dritti che poggiano sul suolo, a gruppi sui due lati della strada.
 * Solo grafica: usa Math.random. Gli edifici superati vengono riposizionati in fondo.
 */
export class Buildings {
  private geometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  private material = new THREE.MeshLambertMaterial();
  private mesh = new THREE.InstancedMesh(this.geometry, this.material, COUNT);
  private slots: Slot[] = [];
  private cluster: Cluster | null = null;
  private clusterLeft = 0;
  /** Campioni della strada già confrontati con gli edifici esistenti. */
  private checked = 0;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(private scene: THREE.Scene) {
    this.mesh.frustumCulled = false; // gli edifici coprono tutta la scena, il bounding non serve
    for (let i = 0; i < COUNT; i++) this.mesh.setColorAt(i, this.c.set("#ffffff"));
    scene.add(this.mesh);
  }

  update(track: Track, kartS: number) {
    const end = (track.samples.length - 1) * STEP;
    if (this.slots.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        const slot: Slot = { s: 0, p: null };
        this.slots.push(slot);
        this.place(i, track, Math.min(end, kartS - BEHIND + ((AHEAD + BEHIND) * i) / COUNT));
      }
      this.checked = track.samples.length;
    }
    let dirty = false;
    // la strada si allunga: un edificio già piazzato può finire sopra un tratto nuovo
    const n = track.samples.length;
    if (n > this.checked) {
      for (let i = 0; i < COUNT; i++) {
        const p = this.slots[i].p;
        if (p && !clearOfRoad(track, p, this.checked, n - 1)) { this.place(i, track, this.respawnS(kartS, end)); dirty = true; }
      }
      this.checked = n;
    }
    for (let i = 0; i < COUNT; i++) {
      if (this.slots[i].s < kartS - BEHIND) { this.place(i, track, this.respawnS(kartS, end)); dirty = true; }
    }
    if (dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor!.needsUpdate = true;
    }
  }

  private respawnS(kartS: number, end: number) {
    return Math.min(end, kartS + RESPAWN_FROM + Math.random() * (AHEAD - RESPAWN_FROM));
  }

  private place(i: number, track: Track, s: number) {
    if (!this.cluster || this.clusterLeft <= 0 || Math.abs(this.cluster.s - s) > 30) {
      this.cluster = newCluster(s, Math.random);
      this.clusterLeft = PER_CLUSTER_MIN + Math.floor(Math.random() * (PER_CLUSTER_MAX - PER_CLUSTER_MIN + 1));
    }
    this.clusterLeft--;
    const p = placeBuilding(track, this.cluster, Math.random);
    const slot = this.slots[i];
    slot.s = s;
    slot.p = p;
    if (!p) { this.mesh.setMatrixAt(i, this.hidden); return; }
    const base = BUILDING_BASE;
    // three: x = core.x, z = -core.y
    this.m.makeScale(p.halfW * 2, p.top - base, p.halfD * 2).setPosition(p.x, base, -p.y);
    this.mesh.setMatrixAt(i, this.m);
    const tints = biomeAt(Math.floor(Math.max(0, s) / CONFIG.biomeLength)).buildings;
    this.mesh.setColorAt(i, this.c.set(tints[Math.floor(Math.random() * tints.length)]));
  }

  /** Edifici visibili (per i test). */
  placements() {
    return this.slots.map((sl) => sl.p).filter((p): p is Placement => p !== null);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

