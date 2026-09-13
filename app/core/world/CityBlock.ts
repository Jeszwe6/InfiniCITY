import * as THREE from "three";

import {
  PlotGenerator,
  type PlotRole,
  type ResidentialBuildingKind,
} from "./PlotGenerator";

import type { BuildingType } from "./BuildingFactory";
import { RoadGenerator } from "./RoadGenerator";
import { Intersection } from "./Intersection";

/**
 * اطلاعات ثابت هر Plot داخل CityBlock.
 *
 * نکته:
 * - موقعیت‌ها طوری انتخاب شده‌اند که Plotها دقیقاً
 *   داخل چهار ناحیه اطراف تقاطع قرار بگیرند.
 * - حصار، پیاده‌رو یا خیابان توسط CityBlock ساخته نمی‌شود.
 *   حصار کاملاً مسئولیت PlotGenerator است.
 */
interface PlotLayout {
  x: number;
  z: number;
  rotation: number;
  role: PlotRole;

  /**
   * آیا Apartment فضای سبز محدود داشته باشد؟
   */
  apartmentHasGreenArea?: boolean;
}

/**
 * CityBlock
 *
 * هر Block یک محله کوچک مستقل است:
 *
 *                    Road
 *          ─────────────────────
 *          │                  │
 *          │  Villa    Apt.   │
 *          │                  │
 *     Road ├──── Intersection ─┤ Road
 *          │                  │
 *          │  Shop     Factory│
 *          │                  │
 *          ─────────────────────
 *                    Road
 *
 * مسئولیت‌های CityBlock:
 *
 * - ساخت Road
 * - ساخت Intersection
 * - تعیین Layout ساختمان‌ها
 * - ساخت Plotها
 *
 * CityBlock خودش:
 * - ساختمان را مستقیماً نمی‌سازد.
 * - حصار را نمی‌سازد.
 * - Nature را مدیریت نمی‌کند.
 *
 * این موارد توسط PlotGenerator و BuildingFactory انجام می‌شوند.
 */
export class CityBlock {
  /**
   * ابعاد کلی Block.
   *
   * با ChunkManager و Road هماهنگ است.
   */
  private static readonly WIDTH = 32;
  private static readonly DEPTH = 32;

  /**
   * ابعاد هر Plot.
   *
   * چهار Plot دقیقاً در چهار ناحیه اطراف
   * خیابان مرکزی قرار می‌گیرند.
   */
  private static readonly PLOT_WIDTH = 12;
  private static readonly PLOT_DEPTH = 12;

  /**
   * فاصله مرکز Plot از مرکز Block.
   *
   * چون:
   *
   * Block = 32
   * Road  = 8
   * Plot  = 12
   *
   * هر Plot باید در مرکز یکی از چهار ناحیه
   * 12×12 قرار بگیرد.
   *
   * بنابراین:
   *
   * 12 / 2 + 8 / 2 = 10
   */
  private static readonly PLOT_OFFSET = 10;

  /**
   * Layout اصلی Block.
   *
   * طراحی عمداً asymmetrical است تا Block
   * شبیه یک مجموعه ساختمان خشک و تکراری نباشد.
   *
   * ┌──────────────────────────────┐
   * │ Villa        Apartment       │
   * │                              │
   * │                              │
   * │──────── Intersection ────────│
   * │                              │
   * │ Commercial      Industrial   │
   * │                              │
   * └──────────────────────────────┘
   *
   * هر ساختمان داخل Plot خودش مستقل باقی می‌ماند.
   */
  private static readonly PLOT_LAYOUT: readonly PlotLayout[] = [
    /**
     * 🏠 Villa
     *
     * - suburban
     * - grass
     * - Nature
     * - path
     * - hedge fence
     * - بدون parking
     */
    {
      x: -CityBlock.PLOT_OFFSET,
      z: -CityBlock.PLOT_OFFSET,
      rotation: THREE.MathUtils.degToRad(0),
      role: "villa",
    },

    /**
     * 🏢 Apartment
     *
     * - commercial model
     * - asphalt
     * - parking
     * - green area محدود
     * - short fence
     */
    {
      x: CityBlock.PLOT_OFFSET,
      z: -CityBlock.PLOT_OFFSET,
      rotation: THREE.MathUtils.degToRad(0),
      role: "apartment",
      apartmentHasGreenArea: true,
    },

    /**
     * 🏪 Commercial
     *
     * - commercial model
     * - asphalt
     * - parking
     * - بدون Nature
     */
    {
      x: -CityBlock.PLOT_OFFSET,
      z: CityBlock.PLOT_OFFSET,
      rotation: THREE.MathUtils.degToRad(0),
      role: "commercial",
    },

    /**
     * 🏭 Industrial
     *
     * - industrial model
     * - asphalt
     * - parking
     * - بدون Nature
     */
    {
      x: CityBlock.PLOT_OFFSET,
      z: CityBlock.PLOT_OFFSET,
      rotation: THREE.MathUtils.degToRad(0),
      role: "industrial",
    },
  ];

  /**
   * گروه اصلی Block.
   */
  public readonly group: THREE.Group;

  /**
   * Generator مشترک Plotها.
   */
  private readonly plotGenerator: PlotGenerator;

  /**
   * Generator خیابان‌ها.
   */
  private readonly roadGenerator: RoadGenerator;

  /**
   * تقاطع مرکزی.
   */
  private readonly intersection: Intersection;

  /**
   * نوع پیش‌فرض BuildingFactory.
   *
   * این مقدار بیشتر برای metadata و سازگاری
   * با معماری فعلی نگه داشته شده است.
   */
  private readonly buildingType: BuildingType;

  /**
   * Promise آماده‌شدن کامل Block.
   */
  private readonly readyPromise: Promise<void>;

  /**
   * آیا Block آماده شده است؟
   */
  private ready = false;

  /**
   * آیا Block dispose شده است؟
   */
  private disposed = false;

  constructor(buildingType: BuildingType = "suburban") {
    this.buildingType = buildingType;

    /**
     * Group اصلی Block.
     */
    this.group = new THREE.Group();
    this.group.name = "CityBlock";

    /**
     * Metadata مربوط به Block.
     */
    this.group.userData.isCityBlock = true;
    this.group.userData.buildingType = this.buildingType;

    /**
     * Generator مشترک Plotها.
     *
     * استفاده از یک Generator باعث می‌شود
     * مدیریت cache و منابع ساده‌تر بماند.
     */
    this.plotGenerator = new PlotGenerator();

    /**
     * Generator خیابان‌ها.
     */
    this.roadGenerator = new RoadGenerator();

    /**
     * ساخت Intersection مرکزی.
     */
    this.intersection = new Intersection();

    this.intersection.group.userData.isIntersection = true;

    /**
     * ابتدا Road و Intersection ساخته می‌شوند
     * تا اسکلت اصلی Block از همان ابتدا وجود داشته باشد.
     */
    this.createRoads();

    /**
     * سپس Plotها به صورت Async ساخته می‌شوند.
     */
    this.readyPromise = this.createPlots();
  }

  /**
   * ساخت خیابان‌ها و Intersection.
   *
   * یک خیابان افقی و یک خیابان عمودی داریم
   * که دقیقاً از مرکز Block عبور می‌کنند.
   */
  private createRoads(): void {
    if (this.disposed) {
      return;
    }

    /**
     * Road عمودی.
     */
    const verticalRoad = this.roadGenerator.createVerticalRoad(CityBlock.DEPTH);

    verticalRoad.position.set(0, 0, 0);

    verticalRoad.userData.isRoad = true;
    verticalRoad.userData.direction = "vertical";

    /**
     * Road افقی.
     */
    const horizontalRoad = this.roadGenerator.createHorizontalRoad(
      CityBlock.WIDTH,
    );

    horizontalRoad.position.set(0, 0, 0);

    horizontalRoad.userData.isRoad = true;
    horizontalRoad.userData.direction = "horizontal";

    /**
     * اضافه‌کردن Roadها.
     */
    this.group.add(verticalRoad);
    this.group.add(horizontalRoad);

    /**
     * Intersection دقیقاً در مرکز Block.
     */
    this.intersection.group.position.set(0, 0, 0);

    /**
     * اضافه‌کردن Intersection.
     */
    this.group.add(this.intersection.group);
  }

  /**
   * منتظر آماده‌شدن کامل Block می‌ماند.
   *
   * ChunkManager از این متد استفاده می‌کند.
   */
  public async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  /**
   * آیا Block آماده استفاده است؟
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * ساخت تمام Plotهای Block.
   *
   * Plotها موازی Load می‌شوند تا ساخت Chunk
   * بیش از حد منتظر یک ساختمان نماند.
   */
  private async createPlots(): Promise<void> {
    if (this.disposed) {
      return;
    }

    /**
     * هر Plot مستقل ساخته می‌شود.
     */
    const plotPromises = CityBlock.PLOT_LAYOUT.map(async (layout) => {
      if (this.disposed) {
        return;
      }

      try {
        /**
         * تعیین نوع واقعی BuildingFactory.
         *
         * Villa:
         * suburban
         *
         * Apartment:
         * commercial
         *
         * Commercial:
         * commercial
         *
         * Industrial:
         * industrial
         */
        const resolvedBuildingType = this.resolveBuildingType(layout.role);

        /**
         * تعیین نوع ساختمان مسکونی.
         *
         * فقط Villa و Apartment ساختمان Residential
         * محسوب می‌شوند.
         */
        const residentialKind: ResidentialBuildingKind =
          layout.role === "apartment" ? "apartment" : "villa";

        /**
         * ساخت Plot.
         *
         * توجه:
         * حصار اینجا ساخته نمی‌شود.
         *
         * PlotGenerator مسئول ساخت حصار در محدوده
         * داخلی Plot است.
         */
        const plot = await this.plotGenerator.createPlot(
          CityBlock.PLOT_WIDTH,
          CityBlock.PLOT_DEPTH,
          resolvedBuildingType,
          layout.rotation,
          residentialKind,
          layout.role,
          layout.apartmentHasGreenArea ?? false,
        );

        /**
         * ممکن است هنگام Load مدل،
         * Block dispose شده باشد.
         */
        if (this.disposed) {
          return;
        }

        /**
         * Metadata Plot.
         */
        plot.userData.isPlot = true;
        plot.userData.plotRole = layout.role;
        plot.userData.buildingType = resolvedBuildingType;

        /**
         * Residential بودن Plot.
         */
        const isResidential =
          layout.role === "villa" || layout.role === "apartment";

        plot.userData.isResidential = isResidential;

        /**
         * نوع ساختمان Residential.
         */
        if (isResidential) {
          plot.userData.residentialKind = layout.role;
        }

        /**
         * وضعیت Green Area Apartment.
         */
        if (layout.role === "apartment") {
          plot.userData.hasGreenArea = layout.apartmentHasGreenArea ?? false;
        }

        /**
         * موقعیت Plot.
         *
         * این موقعیت‌ها طوری محاسبه شده‌اند که
         * Plot دقیقاً داخل محدوده خودش بماند.
         *
         * بنابراین:
         *
         * Road
         *   ↓
         * Sidewalk
         *   ↓
         * Plot
         *   ↓
         * Fence / Building
         *
         * و حصار وارد پیاده‌رو نمی‌شود.
         */
        plot.position.set(layout.x, 0, layout.z);

        /**
         * اضافه‌کردن Plot به Block.
         */
        this.group.add(plot);
      } catch (error) {
        /**
         * شکست یک Plot نباید باعث شود
         * کل Block برای همیشه Loading بماند.
         */
        console.error(
          `[CityBlock] Failed to create ${layout.role} plot:`,
          error,
        );
      }
    });

    /**
     * منتظر تمام Plotها می‌مانیم.
     */
    await Promise.all(plotPromises);

    /**
     * اگر Block هنوز وجود دارد،
     * آن را آماده اعلام می‌کنیم.
     */
    if (!this.disposed) {
      this.ready = true;
    }
  }

  /**
   * تبدیل PlotRole به BuildingType.
   *
   * BuildingFactory فعلاً سه نوع اصلی دارد:
   *
   * - suburban
   * - commercial
   * - industrial
   *
   * Mapping فعلی:
   *
   * Villa      → suburban
   * Apartment  → commercial
   * Shop       → commercial
   * Hospital   → commercial
   * Factory    → industrial
   */
  private resolveBuildingType(role: PlotRole): BuildingType {
    switch (role) {
      /**
       * 🏠 Villa
       */
      case "villa":
        return "suburban";

      /**
       * 🏢 Apartment
       *
       * طبق تصمیم فعلی پروژه:
       * Apartment از مدل‌های Commercial استفاده می‌کند.
       */
      case "apartment":
        return "commercial";

      /**
       * 🏪 Commercial
       */
      case "commercial":
        return "commercial";

      /**
       * 🏥 Hospital
       *
       * فعلاً مدل مستقل Hospital نداریم،
       * بنابراین Commercial استفاده می‌شود.
       */
      case "hospital":
        return "commercial";

      /**
       * 🏭 Industrial
       */
      case "industrial":
        return "industrial";

      /**
       * 🌳 Park
       *
       * Park ساختمان ندارد، اما مقدار معتبر
       * برای API برمی‌گردانیم.
       */
      case "park":
        return "suburban";

      /**
       * Fallback امن.
       */
      default:
        return "suburban";
    }
  }

  /**
   * عرض Block.
   */
  public getWidth(): number {
    return CityBlock.WIDTH;
  }

  /**
   * عمق Block.
   */
  public getDepth(): number {
    return CityBlock.DEPTH;
  }

  /**
   * Update.
   *
   * Blockها در حالت عادی Static هستند.
   *
   * بنابراین هیچ پردازش غیرضروری در هر Frame
   * انجام نمی‌دهیم.
   *
   * این موضوع برای شهر Infinite بسیار مهم است.
   */
  public update(_deltaTime: number): void {
    if (this.disposed) {
      return;
    }

    /**
     * فعلاً عمدی خالی است.
     *
     * Animation یا رفتارهای متحرک بعداً باید
     * فقط برای Objectهایی که واقعاً نیاز دارند
     * فعال شوند.
     */
  }

  /**
   * Dispose کردن Block.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    /**
     * ابتدا وضعیت Dispose را فعال می‌کنیم
     * تا عملیات Async جدید چیزی به Block اضافه نکنند.
     */
    this.disposed = true;

    /**
     * Block دیگر آماده استفاده نیست.
     */
    this.ready = false;

    /**
     * Dispose کردن PlotGenerator.
     *
     * این کار NatureManagerهای متعلق به Plotها
     * را نیز مدیریت می‌کند.
     */
    this.plotGenerator.dispose();

    /**
     * Dispose کردن Intersection.
     */
    this.intersection.dispose();

    /**
     * حذف Object3Dهای Block.
     */
    this.group.clear();
  }
}
