import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * ==========================================
 * NatureManager
 * ==========================================
 *
 * مدیریت تمام عناصر طبیعی CityBlock:
 *
 * 🌳 Tree
 * 🌿 Bush
 * 🪨 Rock
 *
 * Nature به صورت InstancedMesh ساخته می‌شود
 * تا تعداد زیادی Object3D مستقل ایجاد نشود.
 *
 * در هر Plot:
 * - Tree
 * - Bush
 * - Rock
 *
 * به صورت MIX شده و تصادفی قرار می‌گیرند.
 *
 * ==========================================
 */

// ==========================================
// GLTF Loader
// ==========================================

const loader = new GLTFLoader();

// ==========================================
// Tree Cache
// ==========================================

let cachedTreeGeometry: THREE.BufferGeometry | null = null;

let cachedTreeMaterials: THREE.Material[] | null = null;

let treeLoadingPromise: Promise<{
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
}> | null = null;

// ==========================================
// Pending Tree
// ==========================================

interface PendingTree {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

// ==========================================
// Nature Point
// ==========================================

interface NaturePoint {
  x: number;
  z: number;
}

// ==========================================
// Nature Type
// ==========================================

type NatureType = "tree" | "bush" | "rock";

// ==========================================
// NatureManager
// ==========================================

export class NatureManager {
  /**
   * ==========================================
   * ظرفیت‌ها
   * ==========================================
   */

  public static readonly MAX_TREES = 128;

  public static readonly MAX_BUSHES = 128;

  public static readonly MAX_ROCKS = 128;

  /**
   * ==========================================
   * Tree
   * ==========================================
   */

  public static readonly TREE_MODEL_PATH =
    "/assets/nature/Models/GLTF format/tree_default.glb";

  public static readonly TREE_SCALE = 2;

  /**
   * ==========================================
   * Bush
   * ==========================================
   */

  public static readonly BUSH_SCALE = 0.65;

  /**
   * ==========================================
   * Rock
   * ==========================================
   */

  public static readonly ROCK_SCALE = 0.45;

  /**
   * ==========================================
   * Group
   * ==========================================
   */

  public readonly group: THREE.Group;

  /**
   * ==========================================
   * InstancedMesh
   * ==========================================
   */

  private trees: THREE.InstancedMesh | null = null;

  private readonly bushes: THREE.InstancedMesh;

  private readonly rocks: THREE.InstancedMesh;

  /**
   * ==========================================
   * Counters
   * ==========================================
   */

  private treeCount = 0;

  private bushCount = 0;

  private rockCount = 0;

  /**
   * ==========================================
   * Pending Trees
   * ==========================================
   */

  private readonly pendingTrees: PendingTree[] = [];

  /**
   * ==========================================
   * Lifecycle
   * ==========================================
   */

  private ready = false;

  private disposed = false;

  private readonly readyPromise: Promise<void>;

  /**
   * ==========================================
   * Shared Bush Geometry
   * ==========================================
   */

  private static readonly bushGeometry = new THREE.IcosahedronGeometry(0.8, 1);

  /**
   * Bush Material
   */

  private static readonly bushMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f8f3a,
    roughness: 1,
    metalness: 0,
  });

  /**
   * ==========================================
   * Shared Rock Geometry
   * ==========================================
   */

  private static readonly rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);

  /**
   * Rock Material
   */

  private static readonly rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x777777,
    roughness: 1,
    metalness: 0,
  });

  /**
   * ==========================================
   * Temporary Math Objects
   * ==========================================
   */

  private readonly matrix = new THREE.Matrix4();

  private readonly quaternion = new THREE.Quaternion();

  private readonly rotationAxis = new THREE.Vector3(0, 1, 0);

  private readonly position = new THREE.Vector3();

  private readonly scale = new THREE.Vector3();

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */

  constructor() {
    this.group = new THREE.Group();

    this.group.name = "NatureManager";

    /**
     * ========================================
     * Bush InstancedMesh
     * ========================================
     */

    this.bushes = new THREE.InstancedMesh(
      NatureManager.bushGeometry,
      NatureManager.bushMaterial,
      NatureManager.MAX_BUSHES,
    );

    this.bushes.count = 0;

    this.bushes.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    this.bushes.castShadow = false;

    this.bushes.receiveShadow = false;

    this.bushes.frustumCulled = true;

    this.bushes.name = "BushInstances";

    /**
     * ========================================
     * Rock InstancedMesh
     * ========================================
     */

    this.rocks = new THREE.InstancedMesh(
      NatureManager.rockGeometry,
      NatureManager.rockMaterial,
      NatureManager.MAX_ROCKS,
    );

    this.rocks.count = 0;

    this.rocks.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    this.rocks.castShadow = false;

    this.rocks.receiveShadow = false;

    this.rocks.frustumCulled = true;

    this.rocks.name = "RockInstances";

    /**
     * ========================================
     * Add Bush + Rock
     * ========================================
     */

    this.group.add(this.bushes);

    this.group.add(this.rocks);

    /**
     * ========================================
     * Start Tree Loading
     * ========================================
     */

    this.readyPromise = this.initializeTree();
  }

  // ========================================
  // Initialize Tree
  // ========================================

  private async initializeTree(): Promise<void> {
    try {
      const data = await NatureManager.loadTreeModel();

      /**
       * اگر Manager در زمان Load
       * Dispose شده باشد، ادامه نده.
       */

      if (this.disposed) {
        return;
      }

      /**
       * ساخت Tree InstancedMesh.
       *
       * GLB شما دارای دو Material است:
       *
       * woodBark
       * leafsGreen
       *
       * بنابراین Material Array حفظ می‌شود.
       */

      this.trees = new THREE.InstancedMesh(
        data.geometry,
        data.materials,
        NatureManager.MAX_TREES,
      );

      this.trees.count = 0;

      this.trees.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      this.trees.castShadow = false;

      this.trees.receiveShadow = false;

      this.trees.frustumCulled = true;

      this.trees.name = "TreeInstances";

      this.group.add(this.trees);

      this.ready = true;

      /**
       * Treeهای منتظر را اضافه کن.
       */

      this.flushPendingTrees();
    } catch (error) {
      console.error("[NatureManager] Failed to initialize tree:", error);
    }
  }

  // ========================================
  // Add Tree
  // ========================================

  public addTree(
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    scale = NatureManager.TREE_SCALE,
  ): number | null {
    if (this.disposed) {
      return null;
    }

    /**
     * اگر Tree هنوز Load نشده،
     * درخواست را ذخیره کن.
     */

    if (this.trees === null) {
      if (this.pendingTrees.length >= NatureManager.MAX_TREES) {
        return null;
      }

      this.pendingTrees.push({
        x,
        y,
        z,
        rotationY,
        scale,
      });

      return null;
    }

    /**
     * بررسی ظرفیت.
     */

    if (this.treeCount >= NatureManager.MAX_TREES) {
      return null;
    }

    const index = this.addTreeInstance(x, y, z, rotationY, scale);

    this.trees.instanceMatrix.needsUpdate = true;

    return index;
  }

  // ========================================
  // Add Tree Instance
  // ========================================

  private addTreeInstance(
    x: number,
    y: number,
    z: number,
    rotationY: number,
    scale: number,
  ): number {
    if (this.trees === null) {
      return -1;
    }

    if (this.treeCount >= NatureManager.MAX_TREES) {
      return -1;
    }

    const index = this.treeCount;

    /**
     * Position
     */

    this.position.set(x, y, z);

    /**
     * Rotation
     */

    this.quaternion.setFromAxisAngle(this.rotationAxis, rotationY);

    /**
     * Scale
     */

    this.scale.set(scale, scale, scale);

    /**
     * Matrix
     */

    this.matrix.compose(this.position, this.quaternion, this.scale);

    this.trees.setMatrixAt(index, this.matrix);

    this.treeCount++;

    this.trees.count = this.treeCount;

    return index;
  }

  // ========================================
  // Flush Pending Trees
  // ========================================

  private flushPendingTrees(): void {
    if (this.trees === null) {
      return;
    }

    if (this.pendingTrees.length === 0) {
      return;
    }

    for (const tree of this.pendingTrees) {
      if (this.treeCount >= NatureManager.MAX_TREES) {
        break;
      }

      this.addTreeInstance(tree.x, tree.y, tree.z, tree.rotationY, tree.scale);
    }

    this.pendingTrees.length = 0;

    this.trees.instanceMatrix.needsUpdate = true;

    this.trees.computeBoundingSphere();
  }

  // ========================================
  // Add Bush
  // ========================================

  public addBush(
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    scale = NatureManager.BUSH_SCALE,
  ): number | null {
    if (this.disposed) {
      return null;
    }

    if (this.bushCount >= NatureManager.MAX_BUSHES) {
      return null;
    }

    const index = this.bushCount;

    this.position.set(x, y, z);

    this.quaternion.setFromAxisAngle(this.rotationAxis, rotationY);

    /**
     * تغییر جزئی اندازه.
     */

    this.scale.set(scale, scale * (0.75 + Math.random() * 0.25), scale);

    this.matrix.compose(this.position, this.quaternion, this.scale);

    this.bushes.setMatrixAt(index, this.matrix);

    this.bushCount++;

    this.bushes.count = this.bushCount;

    this.bushes.instanceMatrix.needsUpdate = true;

    return index;
  }

  // ========================================
  // Add Rock
  // ========================================

  public addRock(
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    scale = NatureManager.ROCK_SCALE,
  ): number | null {
    if (this.disposed) {
      return null;
    }

    if (this.rockCount >= NatureManager.MAX_ROCKS) {
      return null;
    }

    const index = this.rockCount;

    this.position.set(x, y, z);

    this.quaternion.setFromAxisAngle(this.rotationAxis, rotationY);

    /**
     * تغییر تصادفی شکل سنگ.
     */

    this.scale.set(
      scale * (0.8 + Math.random() * 0.4),

      scale * (0.55 + Math.random() * 0.35),

      scale * (0.75 + Math.random() * 0.35),
    );

    this.matrix.compose(this.position, this.quaternion, this.scale);

    this.rocks.setMatrixAt(index, this.matrix);

    this.rockCount++;

    this.rocks.count = this.rockCount;

    this.rocks.instanceMatrix.needsUpdate = true;

    return index;
  }

  // ========================================
  // Populate Plot
  // ========================================

  // ========================================
  // Populate Plot
  // ========================================

  /**
   * Nature را در محدوده چمن اطراف خانه قرار می‌دهد.
   *
   * نکته مهم:
   * Plot حدود 12x12 است و Sidewalk در اطراف آن قرار دارد.
   * بنابراین Nature نباید نزدیک لبه‌های Plot باشد.
   *
   * محدوده تقریبی چمن:
   * -4 تا +4
   *
   * به این ترتیب Nature روی پیاده‌رو قرار نمی‌گیرد.
   */
  public populatePlot(centerX: number, centerZ: number, rotationY = 0): void {
    if (this.disposed) {
      return;
    }

    /**
     * نقاط داخل محدوده چمن.
     *
     * این نقاط عمداً از لبه‌های Plot فاصله دارند.
     */
    const points: NaturePoint[] = [
      {
        x: -3.8,
        z: -3.8,
      },
      {
        x: 3.8,
        z: -3.8,
      },
      {
        x: -3.8,
        z: 3.8,
      },
      {
        x: 3.8,
        z: 3.8,
      },
      {
        x: 0,
        z: -3.8,
      },
      {
        x: 3.8,
        z: 0,
      },
      {
        x: 0,
        z: 3.8,
      },
      {
        x: -3.8,
        z: 0,
      },
    ];

    /**
     * نقاط را تصادفی می‌کنیم تا هر Plot
     * ظاهر متفاوتی داشته باشد.
     */
    this.shuffle(points);

    /**
     * حداقل یک Tree، یک Bush و یک Rock
     * در هر Plot وجود خواهد داشت.
     */
    const natureTypes: NatureType[] = [
      "tree",
      "bush",
      "rock",
      this.randomNatureType(),
      this.randomNatureType(),
      this.randomNatureType(),
    ];

    /**
     * محل Typeها هم تصادفی می‌شود.
     */
    this.shuffle(natureTypes);

    /**
     * Rotation Plot
     */
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);

    /**
     * کمی جابه‌جایی تصادفی برای طبیعی‌تر شدن.
     */
    const jitter = (): number => -0.45 + Math.random() * 0.9;

    /**
     * Local → World
     */
    const transformPoint = (point: NaturePoint): NaturePoint => {
      const localX = point.x + jitter();

      const localZ = point.z + jitter();

      return {
        x: localX * cos - localZ * sin,

        z: localX * sin + localZ * cos,
      };
    };

    /**
     * فقط 6 عنصر می‌سازیم.
     *
     * این باعث می‌شود فضای اطراف خانه
     * شلوغ نشود.
     */
    for (let i = 0; i < 6; i++) {
      const point = points[i];
      const type = natureTypes[i];

      if (point === undefined || type === undefined) {
        continue;
      }

      const worldPoint = transformPoint(point);

      const x = centerX + worldPoint.x;

      const z = centerZ + worldPoint.z;

      const randomRotation = rotationY + Math.random() * Math.PI * 2;

      /**
       * 🌳 Tree
       */
      if (type === "tree") {
        this.addTree(
          x,
          0,
          z,
          randomRotation,
          NatureManager.TREE_SCALE * (0.9 + Math.random() * 0.2),
        );
      } else if (type === "bush") {
        /**
         * 🌿 Bush
         */
        this.addBush(
          x,
          0,
          z,
          randomRotation,
          NatureManager.BUSH_SCALE * (0.9 + Math.random() * 0.2),
        );
      } else {
        /**
         * 🪨 Rock
         */
        this.addRock(
          x,
          0,
          z,
          randomRotation,
          NatureManager.ROCK_SCALE * (0.9 + Math.random() * 0.2),
        );
      }
    }

    /**
     * Bounds فقط یک بار در انتهای Batch.
     */
    this.updateBounds();
  }

  // ========================================
  // Random Nature Type
  // ========================================

  private randomNatureType(): NatureType {
    const types: NatureType[] = ["tree", "bush", "rock"];

    const index = Math.floor(Math.random() * types.length);

    return types[index] ?? "bush";
  }

  // ========================================
  // Update Bounds
  // ========================================

  private updateBounds(): void {
    if (this.bushCount > 0) {
      this.bushes.computeBoundingSphere();
    }

    if (this.rockCount > 0) {
      this.rocks.computeBoundingSphere();
    }

    if (this.trees !== null && this.treeCount > 0) {
      this.trees.computeBoundingSphere();
    }
  }

  // ========================================
  // Shuffle
  // ========================================

  private shuffle<T>(array: T[]): void {
    /**
     * Fisher-Yates Shuffle
     *
     * به صورت Strict-TypeScript safe.
     */

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      const current = array[i];

      const random = array[j];

      if (current === undefined || random === undefined) {
        continue;
      }

      array[i] = random;

      array[j] = current;
    }
  }

  // ========================================
  // Ready
  // ========================================

  public async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  public isReady(): boolean {
    return this.ready;
  }

  // ========================================
  // Counts
  // ========================================

  public getTreeCount(): number {
    return this.treeCount;
  }

  public getBushCount(): number {
    return this.bushCount;
  }

  public getRockCount(): number {
    return this.rockCount;
  }

  public getPendingTreeCount(): number {
    return this.pendingTrees.length;
  }

  // ========================================
  // Dispose
  // ========================================

  public dispose(): void {
    /**
     * جلوگیری از ادامه Async.
     */

    this.disposed = true;

    /**
     * InstanceMeshها حذف می‌شوند.
     *
     * Geometry و Materialها Shared هستند
     * و اینجا Dispose نمی‌شوند.
     */

    if (this.trees !== null) {
      this.group.remove(this.trees);
    }

    this.group.remove(this.bushes);

    this.group.remove(this.rocks);

    this.group.clear();

    this.pendingTrees.length = 0;

    this.trees = null;

    this.treeCount = 0;

    this.bushCount = 0;

    this.rockCount = 0;

    this.ready = false;
  }

  // ========================================
  // Load Tree Model
  // ========================================

  private static async loadTreeModel(): Promise<{
    geometry: THREE.BufferGeometry;
    materials: THREE.Material[];
  }> {
    /**
     * ======================================
     * Cache
     * ======================================
     */

    if (cachedTreeGeometry !== null && cachedTreeMaterials !== null) {
      return {
        geometry: cachedTreeGeometry,

        materials: cachedTreeMaterials,
      };
    }

    /**
     * ======================================
     * Shared Loading Promise
     * ======================================
     */

    if (treeLoadingPromise !== null) {
      return treeLoadingPromise;
    }

    /**
     * ======================================
     * Load GLB
     * ======================================
     */

    treeLoadingPromise = loader
      .loadAsync(NatureManager.TREE_MODEL_PATH)
      .then((gltf) => {
        let foundMesh: THREE.Mesh | undefined;

        /**
         * پیدا کردن Mesh اصلی.
         */

        gltf.scene.traverse((object) => {
          if (foundMesh === undefined && object instanceof THREE.Mesh) {
            foundMesh = object;
          }
        });

        if (foundMesh === undefined) {
          throw new Error("tree_default.glb does not contain a Mesh.");
        }

        const sourceMesh: THREE.Mesh = foundMesh;

        /**
         * ==================================
         * Geometry
         * ==================================
         */

        const geometry = sourceMesh.geometry.clone();

        /**
         * ==================================
         * Materials
         * ==================================
         */

        const sourceMaterials: THREE.Material[] = Array.isArray(
          sourceMesh.material,
        )
          ? sourceMesh.material
          : [sourceMesh.material];

        const materials = sourceMaterials.map((material) => {
          const cloned = material.clone();

          /**
           * تنظیمات Material درخت.
           */

          if (cloned instanceof THREE.MeshStandardMaterial) {
            cloned.metalness = 0;

            cloned.roughness = Math.max(cloned.roughness, 0.65);
          }

          cloned.needsUpdate = true;

          return cloned;
        });

        /**
         * ==================================
         * Cache
         * ==================================
         */

        cachedTreeGeometry = geometry;

        cachedTreeMaterials = materials;

        return {
          geometry,
          materials,
        };
      })
      .finally(() => {
        treeLoadingPromise = null;
      });

    return treeLoadingPromise;
  }
}
