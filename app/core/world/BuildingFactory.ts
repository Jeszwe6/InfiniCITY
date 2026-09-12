import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { Building } from "./Building";

/**
 * ==========================================
 * انواع ساختمان‌های شهر
 * ==========================================
 */
export type BuildingType =
  | "suburban"
  | "commercial"
  | "industrial";

/**
 * ==========================================
 * مدل‌های ساختمان
 * ==========================================
 */
const BUILDING_MODELS: Record<
  BuildingType,
  string[]
> = {
  /**
   * ------------------------------------------
   * ساختمان‌های مسکونی
   * ------------------------------------------
   */
  suburban: [
    "/assets/buildings/suburban/Models/GLB format/building-type-a.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-b.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-c.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-d.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-e.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-f.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-g.glb",
    "/assets/buildings/suburban/Models/GLB format/building-type-h.glb",
  ],

  /**
   * ------------------------------------------
   * ساختمان‌های تجاری
   * ------------------------------------------
   */
  commercial: [
    "/assets/buildings/commercial/Models/GLB format/building-a.glb",
    "/assets/buildings/commercial/Models/GLB format/building-b.glb",
    "/assets/buildings/commercial/Models/GLB format/building-c.glb",
    "/assets/buildings/commercial/Models/GLB format/building-d.glb",
    "/assets/buildings/commercial/Models/GLB format/building-e.glb",
    "/assets/buildings/commercial/Models/GLB format/building-f.glb",
  ],

  /**
   * ------------------------------------------
   * ساختمان‌های صنعتی
   * ------------------------------------------
   */
  industrial: [
    "/assets/buildings/industrial/Models/GLB format/building-a.glb",
    "/assets/buildings/industrial/Models/GLB format/building-b.glb",
    "/assets/buildings/industrial/Models/GLB format/building-c.glb",
    "/assets/buildings/industrial/Models/GLB format/building-d.glb",
    "/assets/buildings/industrial/Models/GLB format/building-e.glb",
    "/assets/buildings/industrial/Models/GLB format/building-f.glb",
  ],
};

/**
 * ==========================================
 * Shared Loader
 * ==========================================
 */
const sharedLoader =
  new GLTFLoader();

/**
 * ==========================================
 * Shared Model Cache
 * ==========================================
 *
 * مدل اصلی هر GLB فقط یک بار Load می‌شود.
 */
const modelCache =
  new Map<string, THREE.Object3D>();

/**
 * ==========================================
 * Shared Loading Cache
 * ==========================================
 *
 * چند درخواست همزمان برای یک GLB
 * فقط یک Load واقعی ایجاد می‌کنند.
 */
const loadingCache =
  new Map<string, Promise<THREE.Object3D>>();

/**
 * ==========================================
 * BuildingFactory
 * ==========================================
 *
 * انتخاب ساختمان‌ها در هر اجرای جدید برنامه
 * به صورت تصادفی Shuffle می‌شود.
 *
 * نکته:
 *
 * Random فقط هنگام انتخاب مدل ساختمان انجام
 * می‌شود، نه در Animation Loop.
 *
 * بنابراین Performance حفظ می‌شود.
 */
export class BuildingFactory {
  /**
   * ==========================================
   * صف انتخاب مدل‌ها
   * ==========================================
   *
   * برای هر Zone یک ترتیب تصادفی نگه می‌داریم.
   *
   * مثلاً:
   *
   * suburban:
   *
   * D → A → H → C → F → B → G → E
   *
   * بعد از تمام شدن صف، دوباره Shuffle می‌شود.
   */
  private readonly selectionQueues: Record<
    BuildingType,
    string[]
  > = {
    suburban: [],
    commercial: [],
    industrial: [],
  };

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor() {
    /**
     * برای هر نوع ساختمان یک ترتیب تصادفی
     * اولیه ایجاد می‌کنیم.
     */
    this.shuffleQueue("suburban");
    this.shuffleQueue("commercial");
    this.shuffleQueue("industrial");
  }

  /**
   * ==========================================
   * Shuffle Queue
   * ==========================================
   *
   * ترتیب مدل‌های یک Zone را تصادفی می‌کند.
   *
   * Fisher-Yates Shuffle استفاده شده تا
   * توزیع انتخاب‌ها مناسب باشد.
   */
  private shuffleQueue(
    type: BuildingType,
  ): void {
    const models =
      BUILDING_MODELS[type];

    if (models.length === 0) {
      throw new Error(
        `No building models found for type: ${type}`,
      );
    }

    /**
     * یک کپی می‌سازیم تا آرایه اصلی مدل‌ها
     * هرگز تغییر نکند.
     */
    const queue = [
      ...models,
    ];

    /**
     * Fisher-Yates Shuffle
     */
    for (
      let i = queue.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() * (i + 1),
        );

      [
        queue[i],
        queue[j],
      ] = [
        queue[j]!,
        queue[i]!,
      ];
    }

    /**
     * صف جدید
     */
    this.selectionQueues[type] =
      queue;
  }

  /**
   * ==========================================
   * انتخاب مدل
   * ==========================================
   *
   * هر بار یک مدل از صف تصادفی برداشته می‌شود.
   *
   * مزیت:
   *
   * - مدل‌ها با Refresh تغییر می‌کنند.
   * - مدل‌ها بی‌دلیل در هر Frame تغییر نمی‌کنند.
   * - تا جای ممکن مدل‌ها پشت سر هم تکرار
   *   نمی‌شوند.
   */
  private selectModel(
    type: BuildingType,
  ): string {
    let queue =
      this.selectionQueues[type];

    /**
     * اگر صف تمام شده، دوباره Shuffle.
     */
    if (queue.length === 0) {
      this.shuffleQueue(type);

      queue =
        this.selectionQueues[type];
    }

    /**
     * اولین مدل صف را برمی‌داریم.
     */
    const modelPath =
      queue.shift();

    if (!modelPath) {
      throw new Error(
        `Unable to select building model for type: ${type}`,
      );
    }

    return modelPath;
  }

  /**
   * ==========================================
   * Load یک مدل
   * ==========================================
   */
  private async loadModel(
    path: string,
  ): Promise<THREE.Object3D> {
    /**
     * ----------------------------------------
     * Cache
     * ----------------------------------------
     */
    const cached =
      modelCache.get(path);

    if (cached) {
      return cached;
    }

    /**
     * ----------------------------------------
     * Loading Cache
     * ----------------------------------------
     */
    const loading =
      loadingCache.get(path);

    if (loading) {
      return loading;
    }

    /**
     * ----------------------------------------
     * Load واقعی
     * ----------------------------------------
     */
    const promise =
      sharedLoader
        .loadAsync(path)
        .then((gltf) => {
          const model =
            gltf.scene;

          /**
           * آماده‌سازی Meshها
           */
          model.traverse(
            (object) => {
              if (
                object instanceof
                THREE.Mesh
              ) {
                /**
                 * Shadow خاموش
                 *
                 * برای Performance شهر.
                 */
                object.castShadow =
                  false;

                object.receiveShadow =
                  false;

                /**
                 * Frustum Culling
                 */
                object.frustumCulled =
                  true;
              }
            },
          );

          /**
           * ذخیره مدل اصلی
           */
          modelCache.set(
            path,
            model,
          );

          /**
           * Promise دیگر لازم نیست.
           */
          loadingCache.delete(
            path,
          );

          return model;
        })
        .catch((error) => {
          /**
           * اگر Load شکست خورد،
           * اجازه می‌دهیم درخواست بعدی
           * دوباره تلاش کند.
           */
          loadingCache.delete(
            path,
          );

          throw error;
        });

    /**
     * ذخیره Promise
     */
    loadingCache.set(
      path,
      promise,
    );

    return promise;
  }

  /**
   * ==========================================
   * Preload یک دسته
   * ==========================================
   */
  public async preload(
    type: BuildingType,
  ): Promise<void> {
    const models =
      BUILDING_MODELS[type];

    /**
     * همه مدل‌های این دسته
     * همزمان وارد Cache می‌شوند.
     */
    await Promise.all(
      models.map(
        (path) =>
          this.loadModel(path),
      ),
    );
  }

  /**
   * ==========================================
   * Preload همه ساختمان‌ها
   * ==========================================
   */
  public async preloadAll():
    Promise<void> {
    await Promise.all([
      this.preload("suburban"),
      this.preload("commercial"),
      this.preload("industrial"),
    ]);
  }

  /**
   * ==========================================
   * ساخت Building
   * ==========================================
   */
  public async createBuilding(
    type: BuildingType,
    scale: number = 1,
  ): Promise<Building> {
    /**
     * انتخاب مدل تصادفی
     */
    const modelPath =
      this.selectModel(type);

    /**
     * دریافت مدل از Cache یا Load
     */
    const model =
      await this.loadModel(
        modelPath,
      );

    /**
     * ----------------------------------------
     * Clone
     * ----------------------------------------
     *
     * مدل اصلی Shared است.
     *
     * فقط Instance جدید ساخته می‌شود.
     */
    const instance =
      model.clone(true);

    /**
     * ساخت Building
     */
    const building =
      new Building(
        instance,
      );

    /**
     * Scale
     */
    building.setScale(
      scale,
    );

    /**
     * قرار دادن روی زمین
     */
    building.placeOnGround();

    /**
     * ذخیره مدل انتخاب‌شده برای Debug
     *
     * این اطلاعات بعداً برای سیستم Recycling
     * هم می‌تواند مفید باشد.
     */
    building.group.userData.modelPath =
      modelPath;

    return building;
  }

  /**
   * ==========================================
   * وضعیت Cache
   * ==========================================
   */
  public getCacheSize(): number {
    return modelCache.size;
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   *
   * Cache مشترک پاک نمی‌شود، چون توسط Factoryهای
   * دیگر نیز استفاده می‌شود.
   */
  public dispose(): void {
    /**
     * صف‌های انتخاب را خالی می‌کنیم.
     *
     * خود Model Cache دست‌نخورده می‌ماند.
     */
    this.selectionQueues.suburban.length = 0;
    this.selectionQueues.commercial.length = 0;
    this.selectionQueues.industrial.length = 0;

    /**
     * دوباره صف‌ها را آماده می‌کنیم.
     */
    this.shuffleQueue("suburban");
    this.shuffleQueue("commercial");
    this.shuffleQueue("industrial");
  }
}