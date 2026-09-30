import * as THREE from "three";
import {
  PlotGenerator,
  type PlotRole,
  type ResidentialBuildingKind,
} from "./PlotGenerator";
import type { BuildingType } from "./BuildingFactory";
import { RoadGenerator } from "./RoadGenerator";
import { Road } from "./Road";
import { Intersection } from "./Intersection";

/**
 * ==========================================
 * Plot Layout
 * ==========================================
 *
 * تنظیمات مربوط به محل قرارگیری هر Plot
 * داخل CityBlock.
 */
interface PlotLayout {
  x: number;
  z: number;
  rotation: number;
  role: PlotRole;

  // آیا Apartment دارای فضای سبز باشد؟
  apartmentHasGreenArea?: boolean;

  // تغییر محل و اندازه ساختمان داخل Plot
  buildingOffsetX?: number;
  buildingOffsetZ?: number;
  buildingScale?: number;
}

export class CityBlock {
  // ==========================================
  // CityBlock Dimensions
  // ==========================================

  private static readonly WIDTH = 32;
  private static readonly DEPTH = 32;

  // ابعاد هر Plot
  private static readonly PLOT_WIDTH = 12;
  private static readonly PLOT_DEPTH = 12;

  // فاصله Plotها از مرکز CityBlock
  private static readonly PLOT_OFFSET = 10;

  // ==========================================
  // Villa Layout
  // ==========================================

  private static readonly VILLA_LAYOUT: readonly PlotLayout[] = [
    {
      x: -10,
      z: -10,
      rotation: 0,
      role: "villa",
      buildingOffsetX: -0.65,
      buildingOffsetZ: 0.35,
      buildingScale: 3.9,
    },
    {
      x: 10,
      z: -10,
      rotation: 0,
      role: "villa",
      buildingOffsetX: 0.45,
      buildingOffsetZ: 0.55,
      buildingScale: 4.15,
    },
    {
      x: -10,
      z: 10,
      rotation: 0,
      role: "villa",
      buildingOffsetX: -0.45,
      buildingOffsetZ: -0.55,
      buildingScale: 4.05,
    },
    {
      x: 10,
      z: 10,
      rotation: 0,
      role: "villa",
      buildingOffsetX: 0.6,
      buildingOffsetZ: -0.35,
      buildingScale: 3.8,
    },
  ];

  // ==========================================
  // Apartment Layout
  // ==========================================

  private static readonly APARTMENT_LAYOUT: readonly PlotLayout[] = [
    {
      x: -10,
      z: -10,
      rotation: 0,
      role: "apartment",
      apartmentHasGreenArea: true,
      buildingOffsetX: -0.35,
      buildingOffsetZ: 0.25,
      buildingScale: 3.9,
    },
    {
      x: 10,
      z: -10,
      rotation: 0,
      role: "apartment",
      apartmentHasGreenArea: true,
      buildingOffsetX: 0.35,
      buildingOffsetZ: 0.15,
      buildingScale: 4.1,
    },
    {
      x: -10,
      z: 10,
      rotation: 0,
      role: "apartment",
      apartmentHasGreenArea: true,
      buildingOffsetX: -0.25,
      buildingOffsetZ: -0.4,
      buildingScale: 4.05,
    },
    {
      x: 10,
      z: 10,
      rotation: 0,
      role: "apartment",
      apartmentHasGreenArea: true,
      buildingOffsetX: 0.45,
      buildingOffsetZ: -0.3,
      buildingScale: 3.85,
    },
  ];

  // ==========================================
  // Industrial Layout
  // ==========================================

  private static readonly INDUSTRIAL_LAYOUT: readonly PlotLayout[] = [
    {
      x: -10,
      z: -10,
      rotation: 0,
      role: "industrial",
      buildingOffsetX: -0.35,
      buildingOffsetZ: 0.2,
      buildingScale: 4,
    },
    {
      x: 10,
      z: -10,
      rotation: 0,
      role: "industrial",
      buildingOffsetX: 0.4,
      buildingOffsetZ: 0.25,
      buildingScale: 4.15,
    },
  ];

  // ==========================================
  // Internal Objects
  // ==========================================

  public readonly group: THREE.Group;

  private readonly plotGenerator: PlotGenerator;
  private readonly roadGenerator: RoadGenerator;
  private readonly intersection: Intersection;

  private readonly buildingType: BuildingType;

  /**
   * هر Road مستقل باقی می‌ماند.
   *
   * CarManager از همین Roadها برای
   * پیدا کردن شبکه خیابان استفاده می‌کند.
   */
  private readonly roads: Road[] = [];

  // Promise آماده شدن ساختمان‌ها و Plotها
  private readonly readyPromise: Promise<void>;

  private ready = false;
  private disposed = false;

  // ==========================================
  // Constructor
  // ==========================================

  constructor(buildingType: BuildingType = "suburban") {
    this.buildingType = buildingType;

    // گروه اصلی CityBlock
    this.group = new THREE.Group();
    this.group.name = "CityBlock";

    // Metadata مربوط به CityBlock
    this.group.userData.isCityBlock = true;
    this.group.userData.buildingType = this.buildingType;

    // Generatorهای مورد نیاز
    this.plotGenerator = new PlotGenerator();
    this.roadGenerator = new RoadGenerator();

    // Intersection مستقل
    this.intersection = new Intersection();
    this.intersection.group.userData.isIntersection = true;

    // ساخت Roadها
    this.createRoads();

    // ساخت Plotها به صورت asynchronous
    this.readyPromise = this.createPlots();
  }

  // ==========================================
  // Create Roads
  // ==========================================

  private createRoads(): void {
    if (this.disposed) return;

    // ------------------------------------------
    // Vertical Road
    // ------------------------------------------

    const verticalRoad = this.roadGenerator.createVerticalRoad(
      CityBlock.DEPTH,
    );

    verticalRoad.group.position.set(0, 0, 0);

    this.roads.push(verticalRoad);

    // ------------------------------------------
    // Horizontal Road
    // ------------------------------------------

    const horizontalRoad = this.roadGenerator.createHorizontalRoad(
      CityBlock.WIDTH,
    );

    horizontalRoad.group.position.set(0, 0, 0);

    this.roads.push(horizontalRoad);

    // اضافه کردن Roadها به CityBlock
    this.group.add(
      verticalRoad.group,
      horizontalRoad.group,
    );

    // ------------------------------------------
    // Central Intersection
    // ------------------------------------------

    this.intersection.group.position.set(0, 0, 0);

    this.group.add(this.intersection.group);
  }

  // ==========================================
  // Road Access
  // ==========================================

  /**
   * Roadهای فعال این CityBlock را برمی‌گرداند.
   *
   * Roadها مستقل هستند و نباید merge شوند،
   * چون Traffic به آن‌ها نیاز دارد.
   */
  public getRoads(): readonly Road[] {
    return this.roads;
  }

  // ==========================================
  // Plot Layout Selection
  // ==========================================

  private getPlotLayout(): readonly PlotLayout[] {
    switch (this.buildingType) {
      case "suburban":
        return CityBlock.VILLA_LAYOUT;

      case "commercial":
        return CityBlock.APARTMENT_LAYOUT;

      case "industrial":
        return CityBlock.INDUSTRIAL_LAYOUT;

      default:
        return CityBlock.VILLA_LAYOUT;
    }
  }

  // ==========================================
  // Ready State
  // ==========================================

  public async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  public isReady(): boolean {
    return this.ready;
  }

  // ==========================================
  // Create Plots
  // ==========================================

  private async createPlots(): Promise<void> {
    if (this.disposed) return;

    const layouts = this.getPlotLayout();

    /**
     * تمام Plotهای یک Block به صورت asynchronous
     * ساخته می‌شوند.
     */
    const plotPromises = layouts.map(async (layout) => {
      if (this.disposed) return;

      try {
        // تعیین نوع واقعی ساختمان
        const resolvedBuildingType =
          this.resolveBuildingType(layout.role);

        // تعیین نوع ساختمان مسکونی
        const residentialKind: ResidentialBuildingKind =
          layout.role === "apartment"
            ? "apartment"
            : "villa";

        // ساخت Plot
        const plot = await this.plotGenerator.createPlot(
          CityBlock.PLOT_WIDTH,
          CityBlock.PLOT_DEPTH,
          resolvedBuildingType,
          layout.rotation,
          residentialKind,
          layout.role,
          layout.apartmentHasGreenArea ?? false,
        );

        // ممکن است در زمان await، Block dispose شده باشد.
        if (this.disposed) return;

        // ==========================================
        // Plot Metadata
        // ==========================================

        plot.userData.isPlot = true;
        plot.userData.plotRole = layout.role;
        plot.userData.buildingType = resolvedBuildingType;

        const isResidential =
          layout.role === "villa" ||
          layout.role === "apartment";

        plot.userData.isResidential = isResidential;

        // ------------------------------------------
        // Residential Metadata
        // ------------------------------------------

        if (isResidential) {
          plot.userData.residentialKind =
            residentialKind;

          // برای سیستم انتخاب ساختمان در آینده
          plot.userData.isClickable = true;
        }

        // ------------------------------------------
        // Apartment Metadata
        // ------------------------------------------

        if (layout.role === "apartment") {
          plot.userData.hasGreenArea =
            layout.apartmentHasGreenArea ?? false;

          plot.userData.isApartmentGroupMember = true;
          plot.userData.apartmentGroup =
            "apartment-neighborhood";
        }

        // ------------------------------------------
        // Villa Metadata
        // ------------------------------------------

        if (layout.role === "villa") {
          plot.userData.isVillaPlot = true;
        }

        // ==========================================
        // Plot Position
        // ==========================================

        plot.position.set(
          layout.x,
          0,
          layout.z,
        );

        /**
         * Rotation را مستقیم تنظیم می‌کنیم.
         *
         * در نسخه قبلی از *= استفاده شده بود که
         * برای objectهای reuse شده می‌توانست Rotation
         * قبلی را دوباره وارد محاسبه کند.
         */
        plot.rotation.y = layout.rotation;

        // اعمال تنوع ساختمان
        this.applyBuildingVariation(
          plot,
          layout,
        );

        // اضافه کردن Plot به CityBlock
        this.group.add(plot);
      } catch (error) {
        console.error(
          `[CityBlock] Failed to create ${layout.role} plot:`,
          error,
        );
      }
    });

    // صبر برای تکمیل تمام Plotها
    await Promise.all(plotPromises);

    if (!this.disposed) {
      this.ready = true;
    }
  }

  // ==========================================
  // Building Variation
  // ==========================================

  private applyBuildingVariation(
    plot: THREE.Group,
    layout: PlotLayout,
  ): void {
    let building: THREE.Object3D | undefined;

    /**
     * پیدا کردن Building مستقل داخل Plot.
     *
     * ساختمان‌ها merge نمی‌شوند تا در آینده
     * قابلیت انتخاب و تعامل مستقل داشته باشند.
     */
    plot.traverse((object) => {
      if (
        building === undefined &&
        object.userData.isBuilding === true
      ) {
        building = object;
      }
    });

    if (!building) return;

    const buildingObject = building;

    // ==========================================
    // Building Offset
    // ==========================================

    /**
     * عمداً رفتار نسخه قبلی حفظ شده است.
     *
     * مقدار position فعلی ساختمان در offset
     * ضرب می‌شود.
     *
     * این بخش را برای حفظ دقیق ظاهر فعلی
     * شهر تغییر نمی‌دهیم.
     */
    buildingObject.position.x *=
      layout.buildingOffsetX ?? 0;

    buildingObject.position.z *=
      layout.buildingOffsetZ ?? 0;

    // ==========================================
    // Building Scale
    // ==========================================

    /**
     * Scale نیز عمداً با multiplyScalar انجام می‌شود.
     *
     * این نکته مهم است چون Building ممکن است
     * قبل از رسیدن به این مرحله Scale پایه داشته باشد.
     *
     * استفاده از scale.set(...) می‌تواند Scale
     * اصلی Building را از بین ببرد و باعث کوچک شدن
     * خانه‌ها شود.
     */
    if (layout.buildingScale !== undefined) {
      const relativeScale =
        layout.buildingScale / 4;

      buildingObject.scale.multiplyScalar(
        relativeScale,
      );
    }

    // ==========================================
    // Building Rotation
    // ==========================================

    buildingObject.rotation.set(
      0,
      0,
      0,
    );

    // ==========================================
    // Building Metadata
    // ==========================================

    buildingObject.userData.blockOffsetX =
      layout.buildingOffsetX ?? 0;

    buildingObject.userData.blockOffsetZ =
      layout.buildingOffsetZ ?? 0;

    buildingObject.userData.blockScale =
      layout.buildingScale ?? 4;
  }

  // ==========================================
  // Resolve Building Type
  // ==========================================

  private resolveBuildingType(
    role: PlotRole,
  ): BuildingType {
    switch (role) {
      case "villa":
        return "suburban";

      case "apartment":
        return "commercial";

      case "commercial":
        return "commercial";

      case "hospital":
        return "commercial";

      case "industrial":
        return "industrial";

      case "park":
        return "suburban";

      default:
        return "suburban";
    }
  }

  // ==========================================
  // Dimensions
  // ==========================================

  public getWidth(): number {
    return CityBlock.WIDTH;
  }

  public getDepth(): number {
    return CityBlock.DEPTH;
  }

  // ==========================================
  // Update
  // ==========================================

  public update(_deltaTime: number): void {
    if (this.disposed) return;

    /**
     * فعلاً CityBlock منطق Update مستقلی ندارد.
     *
     * Traffic و Roadها در سیستم‌های مربوط
     * به خودشان مدیریت می‌شوند.
     */
  }

  // ==========================================
  // Dispose
  // ==========================================

  public dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.ready = false;

    // پاک‌سازی PlotGenerator
    this.plotGenerator.dispose();

    // پاک‌سازی Intersection
    this.intersection.dispose();

    // پاک کردن referenceهای Road
    this.roads.length = 0;

    // پاک کردن Objectهای داخل CityBlock
    this.group.clear();
  }
}