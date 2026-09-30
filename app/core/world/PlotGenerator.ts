import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { BuildingFactory, type BuildingType } from "./BuildingFactory";
import { Building } from "./Building";
import { NatureManager } from "./NatureManager";

/**
 * نوع ساختمان مسکونی.
 *
 * Villa و Apartment هر دو Residential هستند،
 * اما محیط و سطح اطراف آن‌ها متفاوت است.
 */
export type ResidentialBuildingKind = "villa" | "apartment";

/**
 * نوع کاربری واقعی Plot.
 */
export type PlotRole =
  | "villa"
  | "apartment"
  | "commercial"
  | "hospital"
  | "industrial"
  | "park";

/**
 * نوع سطح Plot.
 */
type PlotSurfaceType = "grass" | "asphalt";

/**
 * نوع Parking.
 */
type ParkingType = "apartment" | "commercial" | "hospital" | "industrial";

/**
 * Loader مشترک Decorationها.
 */
const decorationLoader = new GLTFLoader();

/**
 * Cache مدل‌های Decoration.
 */
const decorationCache = new Map<string, THREE.Object3D>();

/**
 * Promiseهای Loading در حال اجرا.
 */
const decorationLoading = new Map<string, Promise<THREE.Object3D>>();

/**
 * BuildingFactory مشترک بین تمام Plotها.
 *
 * مدل‌ها داخل BuildingFactory cache می‌شوند.
 */
const sharedBuildingFactory = new BuildingFactory();

/**
 * Generator مربوط به Plotها.
 */
export class PlotGenerator {
  /**
   * شماره Plot برای نام‌گذاری.
   */
  private plotIndex = 0;

  /**
   * ساختمان‌های ساخته‌شده.
   *
   * هر ساختمان به صورت مستقل نگهداری می‌شود
   * تا بعداً امکان انتخاب/تعامل جداگانه داشته باشد.
   */
  private readonly buildings = new Set<Building>();

  /**
   * NatureManagerهای Villa و Park.
   */
  private readonly natureManagers = new Set<NatureManager>();

  /**
   * وضعیت Dispose.
   */
  private disposed = false;

  /**
   * ساخت یک Plot کامل.
   *
   * Villa:
   * - Grass
   * - Nature
   * - Path
   * - Hedge Fence
   * - بدون Parking
   *
   * Apartment:
   * - Asphalt
   * - Parking
   * - Green Area اختیاری
   * - Short Fence
   *
   * Commercial:
   * - Asphalt
   * - Parking
   *
   * Hospital:
   * - Asphalt
   * - Parking
   *
   * Industrial:
   * - Asphalt
   * - Parking
   */
  public async createPlot(
    width = 12,
    depth = 12,
    buildingType: BuildingType = "suburban",
    rotation = 0,
    residentialKind: ResidentialBuildingKind = "villa",
    plotRole: PlotRole = "villa",
    apartmentHasGreenArea = false,
  ): Promise<THREE.Group> {
    /**
     * اگر Generator قبلاً Dispose شده باشد،
     * Plot خالی برمی‌گردانیم.
     */
    if (this.disposed) {
      return new THREE.Group();
    }

    const currentPlotIndex = this.plotIndex++;

    /**
     * تشخیص نوع Plot.
     */
    const isVilla = plotRole === "villa";
    const isApartment = plotRole === "apartment";
    const isPark = plotRole === "park";

    const isResidential = isVilla || isApartment;

    /**
     * Villa و Park فقط Grass دارند.
     *
     * Apartment / Commercial / Hospital /
     * Industrial دارای Asphalt هستند.
     */
    const surfaceType: PlotSurfaceType =
      isVilla || isPark ? "grass" : "asphalt";

    /**
     * Group اصلی Plot.
     */
    const plot = new THREE.Group();

    plot.name = `Plot_${currentPlotIndex}`;

    /**
     * Metadata مربوط به Plot.
     */
    plot.userData.isPlot = true;
    plot.userData.plotRole = plotRole;
    plot.userData.buildingType = buildingType;
    plot.userData.surfaceType = surfaceType;
    plot.userData.isResidential = isResidential;

    /**
     * نوع ساختمان مسکونی.
     */
    if (isResidential) {
      plot.userData.residentialKind = residentialKind;
    }

    /**
     * اطلاعات فضای سبز Apartment.
     */
    if (isApartment) {
      plot.userData.hasGreenArea = apartmentHasGreenArea;
    }

    /**
     * ساخت سطح اصلی Plot.
     */
    this.createPlotSurface(plot, width, depth, surfaceType);

    /**
     * Apartment می‌تواند فضای سبز محدود داشته باشد.
     *
     * سطح اصلی همچنان Asphalt باقی می‌ماند.
     */
    if (isApartment && apartmentHasGreenArea) {
      this.createApartmentGreenArea(plot, width, depth);
    }

    /**
     * فقط Villa و Park طبیعت دارند.
     *
     * Apartment / Commercial / Hospital /
     * Industrial طبیعت ندارند.
     */
    if (isVilla || isPark) {
      const natureManager = new NatureManager();

      this.natureManagers.add(natureManager);

      /**
       * Nature داخل فضای محلی Plot ساخته می‌شود.
       */
      natureManager.populatePlot(0, 0, 0);

      plot.add(natureManager.group);
    }

    /**
     * ساخت ساختمان.
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
    const building = await sharedBuildingFactory.createBuilding(
      buildingType,
      4,
    );

    /**
     * اگر هنگام Load، Generator Dispose شده باشد،
     * ساختمان اضافه نمی‌شود.
     */
    if (this.disposed) {
      return plot;
    }

    /**
     * ساختمان در مرکز Plot قرار می‌گیرد.
     *
     * خود Building کاملاً مستقل است.
     */
    building.group.position.set(0, 0, 0);

    /**
     * ساختمان را کج نمی‌کنیم.
     *
     * چرخش Plot نیز نباید باعث کج‌شدن
     * ساختمان نسبت به محوطه شود.
     */
    building.group.rotation.y = 0;

    /**
     * Metadata ساختمان.
     */
    building.group.userData.isBuilding = true;
    building.group.userData.plotRole = plotRole;
    building.group.userData.isResidential = isResidential;

    /**
     * فقط Villa و Apartment قابل کلیک هستند.
     */
    building.group.userData.isClickable = isResidential;

    /**
     * نوع ساختمان مسکونی.
     */
    if (isResidential) {
      building.group.userData.buildingKind = residentialKind;
    }

    /**
     * Hospital فعلاً از مدل Commercial استفاده می‌کند.
     */
    if (plotRole === "hospital") {
      building.group.userData.buildingKind = "hospital";

      building.group.userData.factoryBuildingType = "commercial";
    }

    /**
     * اتصال ساختمان به Plot.
     */
    plot.add(building.group);

    /**
     * ذخیره برای Lifecycle.
     */
    this.buildings.add(building);

    /**
     * جزئیات Villa.
     *
     * بدون Parking و بدون Asphalt.
     */
    if (isVilla) {
      await this.createResidentialDetails(plot, width, depth);
    }

    /**
     * جزئیات Commercial.
     */
    if (plotRole === "commercial") {
      await this.createCommercialDetails(plot, width, depth, rotation);

      this.createParkingDetails(plot, width, depth, "commercial");
    }

    /**
     * Hospital.
     */
    if (plotRole === "hospital") {
      this.createParkingDetails(plot, width, depth, "hospital");
    }

    /**
     * Industrial / Factory.
     */
    if (plotRole === "industrial") {
      await this.createIndustrialDetails(plot, width, depth, rotation);

      this.createParkingDetails(plot, width, depth, "industrial");
    }

    /**
     * Apartment.
     *
     * - Asphalt
     * - Parking
     * - Green Area اختیاری
     * - Short Fence
     *
     * Nature ندارد.
     */
    if (isApartment) {
      this.createParkingDetails(plot, width, depth, "apartment");

      this.createApartmentFence(plot, width, depth);
    }

    return plot;
  }

  /**
   * ایجاد سطح اصلی Plot.
   *
   * Villa / Park:
   * Grass
   *
   * Apartment / Commercial / Hospital /
   * Industrial:
   * Asphalt
   */
  private createPlotSurface(
    plot: THREE.Group,
    width: number,
    depth: number,
    surfaceType: PlotSurfaceType,
  ): void {
    /**
     * این نوار برای جلوگیری از چسبیدن
     * سطح Plot به خیابان استفاده می‌شود.
     */
    const sidewalkWidth = 1.2;

    const surfaceWidth = Math.max(1, width - sidewalkWidth * 2);

    const surfaceDepth = Math.max(1, depth - sidewalkWidth * 2);

    const isGrass = surfaceType === "grass";

    /**
     * Geometry سبک.
     */
    const geometry = new THREE.BoxGeometry(surfaceWidth, 0.2, surfaceDepth);

    /**
     * رنگ سطح Plot.
     */
    const material = new THREE.MeshStandardMaterial({
      color: isGrass ? 0x88c273 : 0x3f4247,
      roughness: 1,
      metalness: 0,
    });

    const surface = new THREE.Mesh(geometry, material);

    surface.position.y = 0.1;

    surface.name = isGrass ? "PlotGrass" : "PlotAsphalt";

    surface.castShadow = false;
    surface.receiveShadow = true;
    surface.frustumCulled = true;

    plot.add(surface);
  }

  /**
   * ایجاد فضای سبز محدود Apartment.
   *
   * سطح اصلی Apartment همچنان Asphalt است.
   */
  private createApartmentGreenArea(
    plot: THREE.Group,
    width: number,
    depth: number,
  ): void {
    const grassWidth = Math.min(width * 0.62, 7.6);

    const grassDepth = Math.min(depth * 0.52, 6.2);

    const geometry = new THREE.BoxGeometry(grassWidth, 0.12, grassDepth);

    const material = new THREE.MeshStandardMaterial({
      color: 0x8bc34a,
      roughness: 1,
      metalness: 0,
    });

    const grass = new THREE.Mesh(geometry, material);

    /**
     * فضای سبز کمی عقب‌تر است
     * تا Parking جلوتر دیده شود.
     */
    grass.position.set(0, 0.16, -0.9);

    grass.name = "ApartmentGreenArea";

    grass.castShadow = false;
    grass.receiveShadow = true;
    grass.frustumCulled = true;

    plot.add(grass);
  }

  /**
   * ایجاد Parking.
   *
   * فقط خطوط هندسی سبک ساخته می‌شوند.
   *
   * خود سطح Asphalt از PlotSurface می‌آید.
   */
  private createParkingDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    type: ParkingType,
  ): void {
    const parkingGroup = new THREE.Group();

    parkingGroup.name = "Parking";

    /**
     * Parking در قسمت جلویی Plot.
     */
    const parkingZ = depth * 0.27;

    /**
     * تعداد جای پارک.
     */
    const parkingCount =
      type === "apartment"
        ? 4
        : type === "hospital"
          ? 5
          : type === "commercial"
            ? 4
            : 3;

    /**
     * ابعاد هر جای پارک.
     */
    const slotWidth = 1.65;
    const slotDepth = 2.5;

    const totalWidth = parkingCount * slotWidth;

    const startX = -totalWidth / 2 + slotWidth / 2;

    /**
     * Geometry مشترک خطوط.
     */
    const lineGeometry = new THREE.PlaneGeometry(0.07, slotDepth);

    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xe8e8e8,
      side: THREE.DoubleSide,
    });

    /**
     * خطوط بین جای پارک‌ها.
     */
    for (let i = 0; i <= parkingCount; i++) {
      const line = new THREE.Mesh(lineGeometry, lineMaterial);

      line.rotation.x = -Math.PI / 2;

      line.position.set(startX - slotWidth / 2 + i * slotWidth, 0.22, parkingZ);

      line.name = `ParkingLine_${i}`;

      line.frustumCulled = true;

      parkingGroup.add(line);
    }

    /**
     * خط انتهایی Parking.
     */
    const endLineGeometry = new THREE.PlaneGeometry(totalWidth, 0.07);

    const endLine = new THREE.Mesh(endLineGeometry, lineMaterial);

    endLine.rotation.x = -Math.PI / 2;

    endLine.position.set(0, 0.22, parkingZ + slotDepth / 2);

    endLine.name = "ParkingEndLine";

    endLine.frustumCulled = true;

    parkingGroup.add(endLine);

    /**
     * جلوگیری از خروج Parking
     * از محدوده Plot.
     */
    parkingGroup.scale.x = Math.min(1, (width - 2) / Math.max(totalWidth, 1));

    plot.add(parkingGroup);
  }

  /**
   * جزئیات Villa.
   *
   * فقط:
   * - Path
   * - Hedge Fence
   *
   * بدون Parking.
   */
  private async createResidentialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
  ): Promise<void> {
    await this.createPath(plot, width, depth);

    this.createVillaHedgeFence(plot, width, depth);
  }

  /**
   * ایجاد حصار بوته‌ای Villa.
   *
   * نکته مهم:
   *
   * سطح اصلی Plot دارای یک نوار
   * 1.2 واحدی در اطراف خودش است.
   *
   * بنابراین حصار را بر اساس
   * محدوده واقعی سطح داخلی محاسبه می‌کنیم،
   * نه لبه بیرونی Plot.
   *
   * نتیجه:
   *
   * Road
   *   ↓
   * Sidewalk
   *   ↓
   * Plot Surface
   *   ↓
   * Hedge Fence
   *   ↓
   * Villa
   */
  private createVillaHedgeFence(
    plot: THREE.Group,
    width: number,
    depth: number,
  ): void {
    const fenceGroup = new THREE.Group();

    fenceGroup.name = "VillaHedgeFence";

    /**
     * ابعاد هر قطعه Hedge.
     */
    const hedgeSize = 0.55;
    const hedgeHeight = 0.65;

    /**
     * فاصله بین قطعات.
     */
    const spacing = 0.8;

    /**
     * Material مشترک.
     */
    const hedgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f8f3a,
      roughness: 1,
      metalness: 0,
    });

    /**
     * Geometry مشترک.
     */
    const hedgeGeometry = new THREE.BoxGeometry(
      hedgeSize,
      hedgeHeight,
      hedgeSize,
    );

    /**
     * عرض نوار پیاده‌رو داخل Plot.
     *
     * این مقدار با createPlotSurface
     * یکسان است.
     */
    const sidewalkWidth = 1.2;

    /**
     * فاصله واقعی حصار از لبه
     * سطح داخلی Plot.
     *
     * مقدار کوچک است چون خود سطح
     * قبلاً 1.2 واحد از لبه بیرونی فاصله دارد.
     */
    const fenceInset = 0.35;

    /**
     * محدوده واقعی سطح داخلی.
     *
     * مثال برای Plot 12×12:
     *
     * سطح داخلی = 9.6×9.6
     * نیمه سطح = 4.8
     *
     * حصار در حدود ±4.45 قرار می‌گیرد.
     */
    const halfWidth = Math.max(0.5, width / 2 - sidewalkWidth - fenceInset);

    const halfDepth = Math.max(0.5, depth / 2 - sidewalkWidth - fenceInset);

    /**
     * ساخت یک ردیف Hedge افقی.
     */
    const addHorizontalHedgeRow = (
      z: number,
      startX: number,
      endX: number,
    ): void => {
      if (endX < startX) {
        return;
      }

      for (let x = startX; x <= endX; x += spacing) {
        const hedge = new THREE.Mesh(hedgeGeometry, hedgeMaterial);

        hedge.position.set(x, hedgeHeight / 2, z);

        hedge.castShadow = false;
        hedge.receiveShadow = true;
        hedge.frustumCulled = true;

        fenceGroup.add(hedge);
      }
    };

    /**
     * ساخت یک ردیف Hedge عمودی.
     */
    const addVerticalHedgeRow = (
      x: number,
      startZ: number,
      endZ: number,
    ): void => {
      if (endZ < startZ) {
        return;
      }

      for (let z = startZ; z <= endZ; z += spacing) {
        const hedge = new THREE.Mesh(hedgeGeometry, hedgeMaterial);

        hedge.position.set(x, hedgeHeight / 2, z);

        hedge.castShadow = false;
        hedge.receiveShadow = true;
        hedge.frustumCulled = true;

        fenceGroup.add(hedge);
      }
    };

    /**
     * پشت Villa.
     */
    addHorizontalHedgeRow(-halfDepth, -halfWidth, halfWidth);

    /**
     * سمت چپ.
     */
    addVerticalHedgeRow(-halfWidth, -halfDepth, halfDepth);

    /**
     * سمت راست.
     */
    addVerticalHedgeRow(halfWidth, -halfDepth, halfDepth);

    /**
     * جلوی Villa.
     *
     * وسط باز می‌ماند تا مسیر ورودی
     * به خانه مشخص باشد.
     */
    const entranceGap = 2.4;

    addHorizontalHedgeRow(halfDepth, -halfWidth, -entranceGap);

    addHorizontalHedgeRow(halfDepth, entranceGap, halfWidth);

    /**
     * حصار صاف باقی می‌ماند.
     *
     * چون CityBlock فعلاً از
     * Rotationهای قائم استفاده می‌کند.
     */
    fenceGroup.rotation.y = 0;

    fenceGroup.position.y = 0;

    plot.add(fenceGroup);
  }

  /**
   * ایجاد حصار کوتاه Apartment.
   *
   * حصار داخل محدوده سطح Plot قرار می‌گیرد
   * و وارد نوار پیاده‌رو نمی‌شود.
   */
  private createApartmentFence(
    plot: THREE.Group,
    width: number,
    depth: number,
  ): void {
    const fenceGroup = new THREE.Group();

    fenceGroup.name = "ApartmentShortFence";

    /**
     * نوع حصار.
     *
     * فعلاً فلزی است.
     */
    const useMetalFence = true;

    /**
     * ارتفاع پایه.
     */
    const postHeight = 0.65;

    /**
     * عرض پایه.
     */
    const postWidth = 0.08;

    /**
     * ابعاد ریل.
     */
    const railHeight = 0.06;
    const railDepth = 0.06;

    /**
     * فاصله پایه‌ها.
     */
    const spacing = 0.7;

    /**
     * Material مشترک.
     */
    const fenceMaterial = new THREE.MeshStandardMaterial({
      color: useMetalFence ? 0x555b5e : 0x8a633f,
      roughness: 0.85,
      metalness: useMetalFence ? 0.25 : 0,
    });

    /**
     * Geometry پایه.
     */
    const postGeometry = new THREE.BoxGeometry(
      postWidth,
      postHeight,
      postWidth,
    );

    /**
     * Geometry ریل افقی.
     */
    const horizontalRailGeometry = new THREE.BoxGeometry(
      1,
      railHeight,
      railDepth,
    );

    /**
     * Geometry پایه عمودی.
     */
    const verticalRailGeometry = new THREE.BoxGeometry(
      railDepth,
      postHeight,
      railDepth,
    );

    /**
     * نوار پیاده‌رو داخل Plot.
     */
    const sidewalkWidth = 1.2;

    /**
     * فاصله حصار از لبه سطح داخلی.
     *
     * کمی بیشتر از Villa است تا
     * Apartment فضای تنفس بیشتری داشته باشد.
     */
    const fenceInset = 0.45;

    /**
     * محدوده داخلی واقعی حصار.
     */
    const halfWidth = Math.max(0.5, width / 2 - sidewalkWidth - fenceInset);

    const halfDepth = Math.max(0.5, depth / 2 - sidewalkWidth - fenceInset);

    /**
     * ساخت ضلع افقی.
     */
    const addHorizontalFence = (
      z: number,
      startX: number,
      endX: number,
    ): void => {
      const length = endX - startX;

      if (length <= 0) {
        return;
      }

      const rail = new THREE.Mesh(horizontalRailGeometry, fenceMaterial);

      rail.scale.x = length;

      rail.position.set((startX + endX) / 2, postHeight * 0.72, z);

      rail.castShadow = false;
      rail.receiveShadow = false;
      rail.frustumCulled = true;

      fenceGroup.add(rail);

      /**
       * پایه‌های عمودی.
       */
      for (let x = startX; x <= endX; x += spacing) {
        const post = new THREE.Mesh(postGeometry, fenceMaterial);

        post.position.set(x, postHeight / 2, z);

        post.castShadow = false;
        post.receiveShadow = false;
        post.frustumCulled = true;

        fenceGroup.add(post);
      }
    };

    /**
     * ساخت ضلع عمودی.
     */
    const addVerticalFence = (
      x: number,
      startZ: number,
      endZ: number,
    ): void => {
      const length = endZ - startZ;

      if (length <= 0) {
        return;
      }

      const rail = new THREE.Mesh(horizontalRailGeometry, fenceMaterial);

      rail.rotation.y = Math.PI / 2;

      rail.scale.x = length;

      rail.position.set(x, postHeight * 0.72, (startZ + endZ) / 2);

      rail.castShadow = false;
      rail.receiveShadow = false;
      rail.frustumCulled = true;

      fenceGroup.add(rail);

      /**
       * پایه‌های عمودی.
       */
      for (let z = startZ; z <= endZ; z += spacing) {
        const post = new THREE.Mesh(verticalRailGeometry, fenceMaterial);

        post.position.set(x, postHeight / 2, z);

        post.castShadow = false;
        post.receiveShadow = false;
        post.frustumCulled = true;

        fenceGroup.add(post);
      }
    };

    /**
     * پشت Apartment.
     */
    addHorizontalFence(-halfDepth, -halfWidth, halfWidth);

    /**
     * سمت چپ.
     */
    addVerticalFence(-halfWidth, -halfDepth, halfDepth);

    /**
     * سمت راست.
     */
    addVerticalFence(halfWidth, -halfDepth, halfDepth);

    /**
     * جلوی Apartment.
     *
     * ورودی باز می‌ماند.
     */
    const entranceGap = 3.2;

    addHorizontalFence(halfDepth, -halfWidth, -entranceGap);

    addHorizontalFence(halfDepth, entranceGap, halfWidth);

    /**
     * حصار صاف باقی می‌ماند.
     */
    fenceGroup.rotation.y = 0;

    fenceGroup.position.y = 0;

    plot.add(fenceGroup);
  }

  /**
   * جزئیات Commercial.
   */
  private async createCommercialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
  ): Promise<void> {
    await this.createAwning(plot, width, depth, rotation);

    await this.createOverhang(plot, width, depth, rotation);

    await this.createParasol(plot, width, depth, rotation);
  }

  /**
   * جزئیات Industrial.
   */
  private async createIndustrialDetails(
    plot: THREE.Group,
    width: number,
    depth: number,
    rotation: number,
  ): Promise<void> {
    await this.createChimney(plot, width, depth, rotation);

    await this.createTank(plot, width, depth, rotation);
  }

  /**
   * Load کردن Decoration با Cache.
   */
  private async loadDecoration(path: string): Promise<THREE.Object3D> {
    /**
     * بررسی Cache.
     */
    const cached = decorationCache.get(path);

    if (cached) {
      return cached;
    }

    /**
     * بررسی Loading قبلی.
     */
    const existingLoading = decorationLoading.get(path);

    if (existingLoading) {
      return existingLoading;
    }

    /**
     * شروع Loading.
     */
    const loadingPromise = new Promise<THREE.Object3D>((resolve, reject) => {
      decorationLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          /**
           * تنظیمات مشترک مدل.
           */
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = false;

              object.receiveShadow = true;

              object.frustumCulled = true;
            }
          });

          decorationCache.set(path, model);

          decorationLoading.delete(path);

          resolve(model);
        },
        undefined,
        (error) => {
          decorationLoading.delete(path);

          reject(error);
        },
      );
    });

    decorationLoading.set(path, loadingPromise);

    return loadingPromise;
  }

  /**
   * ایجاد مسیر Villa.
   */
  private async createPath(
    plot: THREE.Group,
    _width: number,
    depth: number,
  ): Promise<void> {
    const longPath =
      "/assets/buildings/suburban/Models/GLB format/path-long.glb";

    const shortPath =
      "/assets/buildings/suburban/Models/GLB format/path-short.glb";

    const model = await this.loadDecoration(depth > 10 ? longPath : shortPath);

    /**
     * Clone مدل برای Plot فعلی.
     */
    const path = model.clone(true);

    /**
     * مسیر در قسمت جلویی محوطه قرار می‌گیرد.
     */
    path.position.set(0, 0.03, depth / 2 - 2.2);

    /**
     * مسیر صاف باقی می‌ماند.
     */
    path.rotation.y = 0;

    path.name = "ResidentialPath";

    plot.add(path);
  }

  /**
   * API قبلی برای سازگاری نگه داشته شده است.
   *
   * در حال حاضر حصار Villa را ایجاد می‌کند.
   */
  private async createFence(
    plot: THREE.Group,
    width: number,
    depth: number,
    _rotation: number,
  ): Promise<void> {
    this.createVillaHedgeFence(plot, width, depth);
  }

  /**
   * Awning فروشگاه.
   *
   * فعلاً Placeholder است.
   */
  private async createAwning(
    plot: THREE.Group,
    _width: number,
    _depth: number,
    rotation: number,
  ): Promise<void> {
    void plot;
    void rotation;
  }

  /**
   * Overhang فروشگاه.
   *
   * فعلاً Placeholder است.
   */
  private async createOverhang(
    plot: THREE.Group,
    _width: number,
    _depth: number,
    rotation: number,
  ): Promise<void> {
    void plot;
    void rotation;
  }

  /**
   * Parasol فروشگاه.
   *
   * فعلاً Placeholder است.
   */
  private async createParasol(
    plot: THREE.Group,
    _width: number,
    _depth: number,
    rotation: number,
  ): Promise<void> {
    void plot;
    void rotation;
  }

  /**
   * Chimney کارخانه.
   *
   * فعلاً Placeholder است.
   */
  private async createChimney(
    plot: THREE.Group,
    _width: number,
    _depth: number,
    rotation: number,
  ): Promise<void> {
    void plot;
    void rotation;
  }

  /**
   * Tank کارخانه.
   *
   * فعلاً Placeholder است.
   */
  private async createTank(
    plot: THREE.Group,
    _width: number,
    _depth: number,
    rotation: number,
  ): Promise<void> {
    void plot;
    void rotation;
  }

  /**
   * Update.
   *
   * NatureManager Static است و Update نمی‌خواهد.
   */
  public update(deltaTime: number): void {
    if (this.disposed) {
      return;
    }

    /**
     * در حال حاضر فقط ساختمان‌هایی که
     * واقعاً Update دارند پردازش می‌شوند.
     */
    for (const building of this.buildings) {
      building.update(deltaTime);
    }
  }

  /**
   * Dispose کردن Generator.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    /**
     * ساختمان‌ها.
     *
     * منابع مشترک BuildingFactory
     * در اینجا پاک نمی‌شوند، چون بین
     * Chunkها مشترک هستند.
     */
    this.buildings.clear();

    /**
     * NatureManagerهای Villa/Park.
     */
    for (const natureManager of this.natureManagers) {
      natureManager.dispose();
    }

    this.natureManagers.clear();

    /**
     * Reset index.
     */
    this.plotIndex = 0;
  }
}
