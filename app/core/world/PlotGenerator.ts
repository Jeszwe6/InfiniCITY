import * as THREE from "three";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { BuildingFactory } from "./BuildingFactory";

import { Building } from "./Building";

import type { BuildingType } from "./BuildingFactory";

/**
 * ==========================================
 * Shared Resources
 * ==========================================
 *
 * تمام PlotGeneratorها از این منابع مشترک
 * استفاده می‌کنند.
 *
 * نتیجه:
 *
 * اگر 100 Plot از یک مدل استفاده کنند،
 * فایل GLB فقط یک بار Load می‌شود.
 *
 * بعد از Load:
 *
 * Model
 *   ↓
 * Clone
 *   ↓
 * Plotهای مختلف
 *
 * این کار برای Performance بسیار مهم است.
 * ==========================================
 */

/**
 * Loader مشترک برای Decorationها
 */
const sharedGLTFLoader = new GLTFLoader();

/**
 * Cache مدل‌های Decoration
 */
const decorationCache = new Map<string, THREE.Object3D>();

/**
 * Cache مربوط به Loadهای در حال انجام
 *
 * اگر چند Plot همزمان یک مدل را بخواهند،
 * فقط یک درخواست واقعی Load انجام می‌شود.
 */
const decorationLoadingCache = new Map<string, Promise<THREE.Object3D>>();

/**
 * BuildingFactory مشترک
 *
 * خود BuildingFactory نیز Cache مشترک دارد.
 */
const sharedBuildingFactory = new BuildingFactory();

/**
 * ==========================================
 * PlotGenerator
 * ==========================================
 *
 * مسئول ساخت Plotهای شهری است.
 *
 * هر Plot می‌تواند شامل:
 *
 * - زمین
 * - ساختمان
 * - مسیر
 * - درخت
 * - حصار
 * - جزئیات تجاری
 * - جزئیات صنعتی
 *
 * باشد.
 *
 * برای Performance:
 *
 * - مدل‌های GLB فقط یک بار Load می‌شوند.
 * - مدل‌های Load شده در Cache قرار می‌گیرند.
 * - برای Plotهای مختلف از Clone استفاده می‌کنیم.
 * - Loadهای همزمان نیز با Promise Cache کنترل می‌شوند.
 *
 * هیچ Math.random() در این کلاس استفاده نمی‌شود.
 * بنابراین تنوع Plotها پایدار است.
 * ==========================================
 */
export class PlotGenerator {
  /**
   * BuildingFactory مشترک
   */
  private readonly buildingFactory = sharedBuildingFactory;

  /**
   * شماره Plot
   *
   * برای ایجاد تنوع پایدار
   */
  private plotIndex = 0;

  /**
   * ==========================================
   * Animated Buildings
   * ==========================================
   *
   * فقط Buildingهایی که توسط همین PlotGenerator
   * ساخته شده‌اند در این Set نگهداری می‌شوند.
   *
   * مزیت:
   *
   * به جای Traverse کردن کل شهر در هر Frame،
   * مستقیماً خود ساختمان‌ها را Update می‌کنیم.
   *
   * این روش برای Performance بسیار بهتر است.
   */
  private readonly buildings = new Set<Building>();

  constructor() {
    // تمام منابع به صورت Shared
    // در خارج کلاس ساخته شده‌اند.
  }

  /**
   * ==========================================
   * ساخت Plot
   * ==========================================
   */
  public async createPlot(
    width: number = 12,
    depth: number = 12,
    buildingType: BuildingType = "suburban",
    rotation: number = 0,
  ): Promise<THREE.Group> {
    /**
     * شماره Plot
     */
    const currentPlotIndex = this.plotIndex;

    this.plotIndex++;

    /**
     * Group اصلی Plot
     */
    const plot = new THREE.Group();

    plot.name = `Plot_${currentPlotIndex}`;

    // ------------------------------------------
    // اندازه فضای سبز داخل Plot
    //
    // کمی کوچک‌تر از Plot اصلی است تا
    // پیاده‌رو کاملاً دور آن دیده شود.
    // ------------------------------------------

    const yardInset = 1.2;

    const groundGeometry = new THREE.BoxGeometry(
      width - yardInset,
      0.2,
      depth - yardInset,
    );

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x8bc34a,
      roughness: 1,
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);

    ground.position.y = 0.1;

    ground.name = "PlotGround";

    plot.add(ground);

    /**
     * ==========================================
     * ساختمان
     * ==========================================
     *
     * Scale ساختمان = 5
     */
    const building = await this.buildingFactory.createBuilding(buildingType, 5);

    /**
     * ساختمان را برای Animation ثبت می‌کنیم.
     */
    this.buildings.add(building);
    /**
     * موقعیت ساختمان
     */
    building.group.position.x = 0;

    building.group.position.z = 0;

    /**
     * چرخش ساختمان
     */
    building.group.rotation.y = rotation;

    /**
     * اضافه کردن ساختمان
     */
    plot.add(building.group);

    /**
     * ==========================================
     * Residential
     * ==========================================
     */
    if (buildingType === "suburban") {
      await this.createResidentialDetails(
        plot,
        width,
        depth,
        rotation,
        currentPlotIndex,
      );
    }

    /**
     * ==========================================
     * Commercial
     * ==========================================
     */
    if (buildingType === "commercial") {
      await this.createCommercialDetails(
        plot,
        width,
        depth,
        rotation,
        currentPlotIndex,
      );
    }

    /**
     * ==========================================
     * Industrial
     * ==========================================
     */
    if (buildingType === "industrial") {
      await this.createIndustrialDetails(
        plot,
        width,
        depth,
        rotation,
        currentPlotIndex,
      );
    }

    return plot;
  }

  /**
   * ==========================================
   * Residential Details
   * ==========================================
   */
  private async createResidentialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
    plotIndex: number,
  ): Promise<void> {
    const variation = plotIndex % 5;

    switch (variation) {
      /**
       * مسیر + درخت راست
       */
      case 0:
        await this.createPath(plot, rotation, depth, false);

        await this.createTree(plot, width, depth, "right", rotation);

        break;

      /**
       * مسیر + درخت چپ
       */
      case 1:
        await this.createPath(plot, rotation, depth, false);

        await this.createTree(plot, width, depth, "left", rotation);

        break;

      /**
       * مسیر بلند + دو درخت
       */
      case 2:
        await this.createPath(plot, rotation, depth, true);

        await this.createTree(plot, width, depth, "right", rotation);

        await this.createTree(plot, width, depth, "left", rotation);

        break;

      /**
       * مسیر + حصار
       */
      case 3:
        await this.createPath(plot, rotation, depth, false);

        await this.createFence(plot, width, depth, rotation);

        break;

      /**
       * مسیر + درخت
       */
      default:
        await this.createPath(plot, rotation, depth, false);

        await this.createTree(plot, width, depth, "right", rotation);

        break;
    }
  }

  /**
   * ==========================================
   * Commercial Details
   * ==========================================
   */
  private async createCommercialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
    plotIndex: number,
  ): Promise<void> {
    const variation = plotIndex % 4;

    switch (variation) {
      /**
       * Awning
       */
      case 0:
        await this.createAwning(plot, rotation, false);

        break;

      /**
       * Overhang
       */
      case 1:
        await this.createOverhang(plot, rotation);

        break;

      /**
       * Awning + Parasol
       */
      case 2:
        await this.createAwning(plot, rotation, true);

        await this.createParasol(plot, width, depth, rotation, "a");

        break;

      /**
       * Awning + Parasol دوم
       */
      default:
        await this.createAwning(plot, rotation, false);

        await this.createParasol(plot, width, depth, rotation, "b");

        break;
    }
  }

  /**
   * ==========================================
   * Industrial Details
   * ==========================================
   */
  private async createIndustrialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
    plotIndex: number,
  ): Promise<void> {
    const variation = plotIndex % 4;

    switch (variation) {
      /**
       * Chimney کوچک
       */
      case 0:
        await this.createChimney(
          plot,
          rotation,
          "small",
          -width / 2 + 2,
          -depth / 2 + 2,
        );

        break;

      /**
       * Chimney متوسط
       */
      case 1:
        await this.createChimney(
          plot,
          rotation,
          "medium",
          width / 2 - 2,
          -depth / 2 + 2,
        );

        break;

      /**
       * Chimney + Tank
       */
      case 2:
        await this.createChimney(
          plot,
          rotation,
          "basic",
          -width / 2 + 2,
          -depth / 2 + 2,
        );

        await this.createTank(plot, width, depth, rotation);

        break;

      /**
       * Chimney بزرگ + Tank
       */
      default:
        await this.createChimney(
          plot,
          rotation,
          "large",
          width / 2 - 2,
          -depth / 2 + 2,
        );

        await this.createTank(plot, width, depth, rotation);

        break;
    }
  }

  /**
   * ==========================================
   * ساخت Chimney
   * ==========================================
   */
  private async createChimney(
    plot: THREE.Group,
    rotation: number,
    type: "small" | "basic" | "medium" | "large",
    x: number,
    z: number,
  ): Promise<void> {
    const path = `/assets/buildings/industrial/Models/GLB format/chimney-${type}.glb`;

    const chimney = await this.loadDecoration(path);

    const chimneyClone = chimney.clone(true);

    chimneyClone.name = `IndustrialChimney_${type}`;

    chimneyClone.position.set(x, 0, z);

    chimneyClone.rotation.y = rotation;

    chimneyClone.scale.setScalar(1);

    plot.add(chimneyClone);
  }

  /**
   * ==========================================
   * ساخت Tank
   * ==========================================
   */
  private async createTank(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
  ): Promise<void> {
    const tank = await this.loadDecoration(
      "/assets/buildings/industrial/Models/GLB format/detail-tank.glb",
    );

    const tankClone = tank.clone(true);

    tankClone.name = "IndustrialTank";

    tankClone.position.set(width / 2 - 2, 0, depth / 2 - 2);

    tankClone.rotation.y = rotation;

    tankClone.scale.setScalar(1);

    plot.add(tankClone);
  }

  /**
   * ==========================================
   * ساخت Path
   * ==========================================
   */
  private async createPath(
    plot: THREE.Group,
    rotation: number,
    depth: number,
    long: boolean,
  ): Promise<void> {
    const path = await this.loadDecoration(
      long
        ? "/assets/buildings/suburban/Models/GLB format/path-long.glb"
        : "/assets/buildings/suburban/Models/GLB format/path-short.glb",
    );

    const pathClone = path.clone(true);

    pathClone.name = long ? "PlotPathLong" : "PlotPathShort";

    pathClone.position.set(0, 0, depth / 2 - 2);

    pathClone.rotation.y = rotation;

    plot.add(pathClone);
  }

  /**
   * ==========================================
   * ساخت Tree
   * ==========================================
   */
  private async createTree(
    plot: THREE.Group,
    width: number,
    depth: number,
    side: "left" | "right",
    rotation: number,
  ): Promise<void> {
    const tree = await this.loadDecoration(
      "/assets/buildings/suburban/Models/GLB format/tree-small.glb",
    );

    const treeClone = tree.clone(true);

    treeClone.name = `PlotTree_${side}`;

    const x = side === "right" ? width / 2 - 2 : -width / 2 + 2;

    treeClone.position.set(x, 0, -depth / 2 + 2);

    treeClone.rotation.y = rotation + (side === "right" ? 0.25 : -0.25);

    plot.add(treeClone);
  }

  /**
   * ==========================================
   * ساخت Fence
   * ==========================================
   */
  private async createFence(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
  ): Promise<void> {
    const fence = await this.loadDecoration(
      "/assets/buildings/suburban/Models/GLB format/fence.glb",
    );

    const fenceClone = fence.clone(true);

    fenceClone.name = "PlotFence";

    fenceClone.position.set(0, 0, -depth / 2 + 1);

    fenceClone.rotation.y = rotation;

    fenceClone.scale.setScalar(1);

    plot.add(fenceClone);
  }

  /**
   * ==========================================
   * ساخت Awning
   * ==========================================
   */
  private async createAwning(
    plot: THREE.Group,
    rotation: number,
    wide: boolean,
  ): Promise<void> {
    const awning = await this.loadDecoration(
      wide
        ? "/assets/buildings/commercial/Models/GLB format/detail-awning-wide.glb"
        : "/assets/buildings/commercial/Models/GLB format/detail-awning.glb",
    );

    const awningClone = awning.clone(true);

    awningClone.name = wide ? "CommercialAwningWide" : "CommercialAwning";

    awningClone.position.set(0, 0, 0);

    awningClone.rotation.y = rotation;

    plot.add(awningClone);
  }

  /**
   * ==========================================
   * ساخت Overhang
   * ==========================================
   */
  private async createOverhang(
    plot: THREE.Group,
    rotation: number,
  ): Promise<void> {
    const overhang = await this.loadDecoration(
      "/assets/buildings/commercial/Models/GLB format/detail-overhang.glb",
    );

    const overhangClone = overhang.clone(true);

    overhangClone.name = "CommercialOverhang";

    overhangClone.position.set(0, 0, 0);

    overhangClone.rotation.y = rotation;

    plot.add(overhangClone);
  }

  /**
   * ==========================================
   * ساخت Parasol
   * ==========================================
   */
  private async createParasol(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
    type: "a" | "b",
  ): Promise<void> {
    const parasol = await this.loadDecoration(
      type === "a"
        ? "/assets/buildings/commercial/Models/GLB format/detail-parasol-a.glb"
        : "/assets/buildings/commercial/Models/GLB format/detail-parasol-b.glb",
    );

    const parasolClone = parasol.clone(true);

    parasolClone.name = `CommercialParasol_${type}`;

    parasolClone.position.set(width / 2 - 2, 0, depth / 2 - 2);

    parasolClone.rotation.y = rotation;

    plot.add(parasolClone);
  }

  /**
   * ==========================================
   * Load Decoration
   * ==========================================
   *
   * هر فایل GLB فقط یک بار Load می‌شود.
   *
   * حتی اگر چند Plot همزمان درخواست
   * همان فایل را بدهند، فقط یک Load
   * واقعی انجام خواهد شد.
   * ==========================================
   */
  private async loadDecoration(path: string): Promise<THREE.Object3D> {
    /**
     * ----------------------------------------
     * مرحله 1
     * بررسی Cache
     * ----------------------------------------
     */
    const cached = decorationCache.get(path);

    if (cached) {
      return cached;
    }

    /**
     * ----------------------------------------
     * مرحله 2
     * بررسی Load در حال انجام
     * ----------------------------------------
     */
    const loading = decorationLoadingCache.get(path);

    if (loading) {
      return loading;
    }

    /**
     * ----------------------------------------
     * مرحله 3
     * شروع Load
     * ----------------------------------------
     */
    const loadingPromise = sharedGLTFLoader
      .loadAsync(path)
      .then((gltf) => {
        const model = gltf.scene;

        /**
         * Shadow خاموش
         *
         * برای Performance شهر.
         */
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = false;

            object.receiveShadow = false;

            object.frustumCulled = true;
          }
        });

        /**
         * ذخیره مدل اصلی
         */
        decorationCache.set(path, model);

        /**
         * Load دیگر لازم نیست.
         */
        decorationLoadingCache.delete(path);

        return model;
      })
      .catch((error) => {
        /**
         * اگر Load شکست خورد،
         * Promise را از Cache حذف می‌کنیم
         * تا درخواست بعدی بتواند دوباره
         * Load را امتحان کند.
         */
        decorationLoadingCache.delete(path);

        throw error;
      });

    /**
     * ذخیره Promise
     */
    decorationLoadingCache.set(path, loadingPromise);

    return loadingPromise;
  }

  /**
   * ==========================================
   * Update Animations
   * ==========================================
   *
   * فقط ساختمان‌هایی که توسط این PlotGenerator
   * ساخته شده‌اند Update می‌شوند.
   *
   * هیچ Traverse سنگینی روی کل Scene انجام نمی‌شود.
   */
  public update(deltaTime: number): void {
    if (deltaTime <= 0 || this.buildings.size === 0) {
      return;
    }

    for (const building of this.buildings) {
      building.update(deltaTime);
    }
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */
  public dispose(): void {
    /**
     * ساختمان‌های مربوط به این Generator
     * دیگر برای Animation استفاده نمی‌شوند.
     */
    this.buildings.clear();

    /**
     * شمارنده Plotها Reset می‌شود.
     */
    this.plotIndex = 0;
  }
}
