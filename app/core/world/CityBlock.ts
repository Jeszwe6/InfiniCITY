import * as THREE from "three";

import { RoadGenerator } from "./RoadGenerator";
import { PlotGenerator } from "./PlotGenerator";
import { Intersection } from "./Intersection";
import { Sidewalk } from "./Sidewalk";
import { Tree } from "./Tree";

import type { BuildingType } from "./BuildingFactory";

/**
 * ==========================================
 * Zone Type
 * ==========================================
 *
 * نوع منطقه‌ی شهری.
 */
export type ZoneType =
  | "residential"
  | "commercial"
  | "industrial";

/**
 * ==========================================
 * CityBlock
 * ==========================================
 *
 * یک بلوک کامل از شهر.
 *
 * CityBlock فقط یک بار ساخته می‌شود و بعد
 * می‌تواند توسط ChunkManager بارها Reuse شود.
 *
 * ساختار:
 *
 * Road
 *   +
 * Intersection
 *   +
 * Plot
 *   +
 * Sidewalk
 *   +
 * Tree
 *
 * نکته‌ی مهم:
 *
 * آماده‌شدن ساختمان‌ها با Promise مدیریت می‌شود
 * تا ChunkManager بتواند تشخیص دهد که یک Block
 * واقعاً آماده‌ی Reuse است یا هنوز در حال ساخت است.
 */
export class CityBlock {
  /**
   * ==========================================
   * Group اصلی
   * ==========================================
   */
  public readonly group: THREE.Group;

  /**
   * ==========================================
   * Zone
   * ==========================================
   */
  private readonly zoneType: ZoneType;

  /**
   * ==========================================
   * Plot Generator
   * ==========================================
   *
   * فقط یک بار ساخته می‌شود.
   */
  private readonly plotGenerator =
    new PlotGenerator();

  /**
   * ==========================================
   * اندازه‌ی CityBlock
   * ==========================================
   */
  public static readonly WIDTH = 32;

  public static readonly DEPTH = 32;

  /**
   * ==========================================
   * Ready State
   * ==========================================
   *
   * زمانی که Plotها و ساختمان‌های اولیه ساخته
   * شدند، این مقدار true می‌شود.
   *
   * تا قبل از آن، Block نباید وارد چرخه‌ی
   * Reuse سریع شود.
   */
  private ready = false;

  /**
   * Promise آماده‌شدن Block
   *
   * این Promise فقط یک بار در زمان ساخت اولیه
   * ایجاد می‌شود.
   */
  private readonly readyPromise: Promise<void>;

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */
  constructor(
    zoneType: ZoneType = "residential",
  ) {
    /**
     * ----------------------------------------
     * Group
     * ----------------------------------------
     */
    this.group =
      new THREE.Group();

    this.zoneType =
      zoneType;

    this.group.name =
      `CityBlock_${zoneType}`;

    /**
     * ========================================
     * Road
     * ========================================
     */
    const roadGenerator =
      new RoadGenerator();

    /**
     * جاده‌ی افقی
     */
    const horizontalRoad =
      roadGenerator.createHorizontalRoad(
        CityBlock.WIDTH,
      );

    horizontalRoad.position.z = 0;

    this.group.add(
      horizontalRoad,
    );

    /**
     * جاده‌ی عمودی
     */
    const verticalRoad =
      roadGenerator.createVerticalRoad(
        CityBlock.DEPTH,
      );

    verticalRoad.position.x = 0;

    this.group.add(
      verticalRoad,
    );

    /**
     * ========================================
     * Intersection
     * ========================================
     */
    const intersection =
      new Intersection();

    this.group.add(
      intersection.group,
    );

    /**
     * ========================================
     * Plotها
     * ========================================
     *
     * ساخت اولیه را شروع می‌کنیم.
     *
     * Constructor نمی‌تواند await داشته باشد،
     * بنابراین Promise را ذخیره می‌کنیم.
     */
    this.readyPromise =
      this.createPlots().then(() => {
        this.ready = true;
      });
  }

  /**
   * ==========================================
   * تعیین نوع ساختمان
   * ==========================================
   */
  private getBuildingType():
    BuildingType {
    switch (
      this.zoneType
    ) {
      case "commercial":
        return "commercial";

      case "industrial":
        return "industrial";

      case "residential":
      default:
        return "suburban";
    }
  }

  /**
   * ==========================================
   * ساخت Plotها
   * ==========================================
   *
   * چهار Plot به صورت موازی ساخته می‌شوند.
   */
  private async createPlots():
    Promise<void> {

    const buildingType =
      this.getBuildingType();

    /**
     * اندازه‌ی Plot
     */
    const plotWidth = 12;

    const plotDepth = 12;

    /**
     * موقعیت چهار Plot
     */
    const positions = [
      {
        x: -10,
        z: -10,
        rotation: 0,
      },

      {
        x: 10,
        z: -10,
        rotation:
          Math.PI / 2,
      },

      {
        x: -10,
        z: 10,
        rotation:
          Math.PI,
      },

      {
        x: 10,
        z: 10,
        rotation:
          Math.PI * 1.5,
      },
    ];

    /**
     * ----------------------------------------
     * ساخت موازی
     * ----------------------------------------
     */
    const plotPromises =
      positions.map(
        async (position) => {

          const plot =
            await this.plotGenerator.createPlot(
              plotWidth,
              plotDepth,
              buildingType,
              position.rotation,
            );

          /**
           * موقعیت Plot
           */
          plot.position.set(
            position.x,
            0,
            position.z,
          );

          this.group.add(
            plot,
          );

          /**
           * ----------------------------------
           * Sidewalk
           * ----------------------------------
           */
          const sidewalk =
            new Sidewalk();

          sidewalk.group.position.set(
            position.x,
            0,
            position.z,
          );

          sidewalk.group.rotation.y =
            position.rotation;

          this.group.add(
            sidewalk.group,
          );

          /**
           * ----------------------------------
           * Trees
           * ----------------------------------
           */
          this.addTree(
            position.x - 4.8,
            position.z - 4.8,
          );

          this.addTree(
            position.x + 4.8,
            position.z + 4.8,
          );
        },
      );

    /**
     * صبر تا هر چهار Plot کامل شوند.
     */
    await Promise.all(
      plotPromises,
    );
  }

  /**
   * ==========================================
   * Wait Until Ready
   * ==========================================
   *
   * ChunkManager می‌تواند از این متد استفاده
   * کند تا قبل از Reuse مطمئن شود Block کامل
   * ساخته شده است.
   */
  public async waitUntilReady():
    Promise<void> {

    await this.readyPromise;
  }

  /**
   * ==========================================
   * Ready State
   * ==========================================
   */
  public isReady(): boolean {
    return this.ready;
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   *
   * فعلاً سبک نگه داشته شده است.
   */
  public update(
    deltaTime: number,
  ): void {

    this.plotGenerator.update(
      deltaTime,
    );
  }

  /**
   * ==========================================
   * Reset For Reuse
   * ==========================================
   *
   * هیچ Object جدیدی ساخته نمی‌شود.
   *
   * فقط وضعیت Transform و Visibility
   * به حالت پایه برمی‌گردد.
   */
  public resetForReuse(): void {

    /**
     * Block قابل مشاهده باشد.
     */
    this.group.visible = true;

    /**
     * Scale اصلی
     */
    this.group.scale.set(
      1,
      1,
      1,
    );

    /**
     * Rotation اصلی
     */
    this.group.rotation.set(
      0,
      0,
      0,
    );
  }

  /**
   * ==========================================
   * اضافه کردن Tree
   * ==========================================
   */
  private addTree(
    x: number,
    z: number,
  ): void {

    const tree =
      new Tree();

    tree.group.position.set(
      x,
      0,
      z,
    );

    this.group.add(
      tree.group,
    );
  }

  /**
   * ==========================================
   * دریافت Zone
   * ==========================================
   */
  public getZoneType():
    ZoneType {

    return this.zoneType;
  }
}