import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Building, type ResidentialBuildingKind } from "./Building";

/**
 * ==========================================
 * Building Types
 * ==========================================
 *
 * انواع اصلی ساختمان در شهر.
 *
 * residential در CityBlock به suburban
 * تبدیل می‌شود.
 */
export type BuildingType = "suburban" | "commercial" | "industrial";

/**
 * ==========================================
 * Building Model Paths
 * ==========================================
 *
 * مسیر واقعی مدل‌های ساختمان داخل
 * public/assets.
 *
 * توجه:
 * فاصله موجود در "GLB format" در URL
 * با %20 نوشته شده است.
 */
const BUILDING_MODELS: Record<BuildingType, readonly string[]> = {
  /**
   * ----------------------------------------
   * ساختمان‌های منطقه مسکونی
   * ----------------------------------------
   *
   * مدل‌های موجود: A تا U
   *
   * نوع دقیق هر مدل (villa/apartment)
   * جداگانه مشخص می‌شود.
   */
  suburban: [
    "/assets/buildings/suburban/Models/GLB%20format/building-type-a.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-b.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-c.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-d.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-e.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-f.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-g.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-h.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-i.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-j.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-k.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-l.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-m.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-n.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-o.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-p.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-q.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-r.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-s.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-t.glb",
    "/assets/buildings/suburban/Models/GLB%20format/building-type-u.glb",
  ],

  /**
   * ----------------------------------------
   * ساختمان‌های تجاری
   * ----------------------------------------
   */
  commercial: [
    "/assets/buildings/commercial/Models/GLB%20format/building-a.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-b.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-c.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-d.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-e.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-f.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-g.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-h.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-i.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-j.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-k.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-l.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-m.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-n.glb",

    // ساختمان‌های بلند تجاری
    "/assets/buildings/commercial/Models/GLB%20format/building-skyscraper-a.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-skyscraper-b.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-skyscraper-c.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-skyscraper-d.glb",
    "/assets/buildings/commercial/Models/GLB%20format/building-skyscraper-e.glb",
  ],

  /**
   * ----------------------------------------
   * ساختمان‌های صنعتی
   * ----------------------------------------
   */
  industrial: [
    "/assets/buildings/industrial/Models/GLB%20format/building-a.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-b.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-c.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-d.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-e.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-f.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-g.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-h.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-i.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-j.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-k.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-l.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-m.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-n.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-o.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-p.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-q.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-r.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-s.glb",
    "/assets/buildings/industrial/Models/GLB%20format/building-t.glb",
  ],
};

/**
 * ==========================================
 * Shared GLTF Loader
 * ==========================================
 *
 * یک Loader مشترک برای تمام ساختمان‌ها.
 *
 * باعث جلوگیری از ساخت Loaderهای متعدد
 * و کاهش سربار می‌شود.
 */
const sharedGLTFLoader = new GLTFLoader();

/**
 * ==========================================
 * Model Cache
 * ==========================================
 *
 * مدل‌هایی که کاملاً Load شده‌اند.
 *
 * مدل اصلی هیچ‌وقت مستقیماً وارد صحنه
 * نمی‌شود.
 *
 * هر ساختمان از آن Clone می‌شود.
 */
const modelCache = new Map<string, THREE.Object3D>();

/**
 * ==========================================
 * Loading Cache
 * ==========================================
 *
 * مدل‌هایی که هنوز در حال Load هستند.
 *
 * اگر چند ساختمان همزمان یک مدل را
 * درخواست کنند، فقط یک Network Request
 * انجام می‌شود.
 */
const loadingCache = new Map<string, Promise<THREE.Object3D>>();

/**
 * ==========================================
 * BuildingFactory
 * ==========================================
 */
export class BuildingFactory {
  /**
   * ========================================
   * Model Selection Queues
   * ========================================
   *
   * مدل‌ها به صورت Shuffle شده مصرف می‌شوند
   * تا مدل مشابه پشت سر هم ظاهر نشود.
   */
  private readonly selectionQueues: Record<BuildingType, string[]> = {
    suburban: [],
    commercial: [],
    industrial: [],
  };

  constructor() {
    this.resetSelectionQueues();
  }

  /**
   * ==========================================
   * Create Building
   * ==========================================
   *
   * یک ساختمان مستقل ایجاد می‌کند.
   *
   * نکته مهم:
   *
   * originalModel از Cache می‌آید،
   * اما با clone(true) یک Object3D مستقل
   * برای این ساختمان ساخته می‌شود.
   *
   * بنابراین ساختمان‌ها می‌توانند
   * جداگانه Click شوند.
   */
  public async createBuilding(
    type: BuildingType,
    scale: number = 1,
    residentialKind: ResidentialBuildingKind = "none",
  ): Promise<Building> {
    /**
     * مدل بعدی را انتخاب می‌کنیم.
     */
    const modelPath = this.getNextModelPath(type);

    /**
     * مدل را از Cache یا Network می‌گیریم.
     */
    const originalModel = await this.loadModel(modelPath);

    /**
     * ----------------------------------------
     * Clone مستقل
     * ----------------------------------------
     *
     * Geometry و Materialهای Cache شده
     * قابل اشتراک هستند.
     *
     * اما Object3D hierarchy مستقل است.
     *
     * این دقیقاً چیزی است که برای
     * Independent Picking نیاز داریم.
     */
    const model = originalModel.clone(true);

    /**
     * Building مستقل.
     */
    const building = new Building(model);

    /**
     * Scale ثابت ساختمان.
     *
     * هیچ Animation ورود/خروج وجود ندارد.
     */
    building.setScale(scale);

    /**
     * قرار دادن کف ساختمان روی زمین.
     */
    building.placeOnGround();

    /**
     * ----------------------------------------
     * Building Metadata
     * ----------------------------------------
     */
    building.group.userData.modelPath = modelPath;

    building.group.userData.buildingType = type;

    /**
     * ----------------------------------------
     * Residential Metadata
     * ----------------------------------------
     *
     * فقط suburban اجازه دارد
     * villa/apartment داشته باشد.
     *
     * commercial و industrial همیشه
     * none هستند.
     */
    if (type === "suburban") {
      building.setResidentialKind(residentialKind);
    } else {
      building.setResidentialKind("none");
    }

    return building;
  }

  /**
   * ==========================================
   * Create Residential Building
   * ==========================================
   *
   * Wrapper مخصوص ساختمان‌های مسکونی.
   *
   * استفاده از این متد باعث می‌شود
   * اشتباهاً نوع commercial/industrial
   * برای ساختمان مسکونی ارسال نشود.
   */
  public async createResidentialBuilding(
    kind: Exclude<ResidentialBuildingKind, "none">,
    scale: number = 1,
  ): Promise<Building> {
    return this.createBuilding("suburban", scale, kind);
  }

  /**
   * ==========================================
   * Preload
   * ==========================================
   *
   * تمام مدل‌های یک دسته را از قبل Load
   * می‌کند.
   */
  public async preload(type: BuildingType): Promise<void> {
    const models = BUILDING_MODELS[type];

    await Promise.all(models.map((path) => this.loadModel(path)));
  }

  /**
   * ==========================================
   * Load Model
   * ==========================================
   */
  private loadModel(path: string): Promise<THREE.Object3D> {
    /**
     * اگر قبلاً Load شده باشد،
     * مستقیماً Cache را برمی‌گردانیم.
     */
    const cached = modelCache.get(path);

    if (cached) {
      return Promise.resolve(cached);
    }

    /**
     * اگر همین الان در حال Load است،
     * Promise قبلی را استفاده می‌کنیم.
     */
    const loading = loadingCache.get(path);

    if (loading) {
      return loading;
    }

    /**
     * ----------------------------------------
     * شروع Loading
     * ----------------------------------------
     */
    const loadingPromise = sharedGLTFLoader
      .loadAsync(path)
      .then((gltf) => {
        const model = gltf.scene;

        /**
         * ------------------------------------
         * Shared Mesh Optimization
         * ------------------------------------
         */
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            /**
             * Shadow خاموش.
             */
            object.castShadow = false;

            object.receiveShadow = false;

            /**
             * Frustum Culling فعال.
             */
            object.frustumCulled = true;

            /**
             * Material مشترک مدل.
             */
            const material = object.material;

            if (material && !Array.isArray(material)) {
              /**
               * Textureهای رنگی
               * باید در فضای sRGB باشند.
               */
              if (material.map) {
                material.map.colorSpace = THREE.SRGBColorSpace;
              }

              /**
               * ساختمان‌ها فلزی نیستند.
               */
              if ("metalness" in material) {
                material.metalness = 0;
              }

              /**
               * جلوگیری از ظاهر
               * بیش از حد براق.
               */
              if ("roughness" in material) {
                material.roughness = Math.max(material.roughness, 0.65);
              }
            }
          }
        });

        /**
         * ذخیره مدل اصلی در Cache.
         */
        modelCache.set(path, model);

        /**
         * Loading دیگر فعال نیست.
         */
        loadingCache.delete(path);

        return model;
      })
      .catch((error) => {
        /**
         * Promise خراب را حذف می‌کنیم
         * تا امکان تلاش مجدد وجود داشته باشد.
         */
        loadingCache.delete(path);

        console.error(`[BuildingFactory] Failed to load model: ${path}`, error);

        throw error;
      });

    loadingCache.set(path, loadingPromise);

    return loadingPromise;
  }

  /**
   * ==========================================
   * Get Next Model Path
   * ==========================================
   */
  private getNextModelPath(type: BuildingType): string {
    let queue = this.selectionQueues[type];

    /**
     * اگر تمام مدل‌ها استفاده شدند،
     * دوباره Shuffle می‌کنیم.
     */
    if (queue.length === 0) {
      queue = [...BUILDING_MODELS[type]];

      this.shuffle(queue);

      this.selectionQueues[type] = queue;
    }

    return queue.shift()!;
  }

  /**
   * ==========================================
   * Reset Selection Queues
   * ==========================================
   */
  private resetSelectionQueues(): void {
    const types: BuildingType[] = ["suburban", "commercial", "industrial"];

    for (const type of types) {
      const queue = [...BUILDING_MODELS[type]];

      this.shuffle(queue);

      this.selectionQueues[type] = queue;
    }
  }

  /**
   * ==========================================
   * Fisher-Yates Shuffle
   * ==========================================
   */
  private shuffle(array: string[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      const first = array[i]!;

      const second = array[j]!;

      array[i] = second;
      array[j] = first;
    }
  }

  /**
   * ==========================================
   * Reset
   * ==========================================
   */
  public reset(): void {
    this.resetSelectionQueues();
  }

  /**
   * ==========================================
   * Cache Statistics
   * ==========================================
   */
  public getStats(): {
    cachedModels: number;
    loadingModels: number;
  } {
    return {
      cachedModels: modelCache.size,

      loadingModels: loadingCache.size,
    };
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   *
   * Factory خودش Resource اختصاصی ندارد.
   *
   * Cache عمداً پاک نمی‌شود، چون مدل‌ها
   * بین Chunkهای مختلف قابل استفاده هستند.
   */
  public dispose(): void {
    this.resetSelectionQueues();
  }
}
