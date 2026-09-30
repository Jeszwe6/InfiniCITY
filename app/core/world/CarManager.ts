import * as THREE from "three";

import { Vehicle } from "./Vehicle";
import type { VehicleDirection } from "./Vehicle";

import VehicleFactory from "./VehicleFactory";
import type { VehicleModelType } from "./Vehicle";

import { Road } from "../world/Road";

/**
 * ==========================================
 * Traffic Transition
 * ==========================================
 *
 * اطلاعات حرکت خودرو بین دو Road.
 */
interface TrafficTransition {
  fromRoad: Road;
  toRoad: Road;

  fromLaneIndex: number;
  toLaneIndex: number;

  start: THREE.Vector3;
  control: THREE.Vector3;
  end: THREE.Vector3;

  finalDirection: VehicleDirection;
  finalDistance: number;

  elapsed: number;
  duration: number;
}

/**
 * ==========================================
 * Active Vehicle Data
 * ==========================================
 */
interface ActiveVehicleData {
  vehicle: Vehicle;

  road: Road;
  laneIndex: number;
  roadDistance: number;

  trafficTransition: TrafficTransition | null;

  /**
   * سرعت طبیعی این خودرو.
   *
   * این مقدار در طول عمر خودرو ثابت می‌ماند تا هنگام
   * عبور از Roadهای مختلف، سرعت ناگهان عوض نشود.
   */
  cruiseSpeed: number;

  /**
   * سرعت واقعی مورد استفاده برای حرکت Transform خودرو.
   *
   * این مقدار هر Frame به‌صورت نرم به targetSpeed نزدیک می‌شود.
   */
  motionSpeed: number;

  /**
   * سرعت هدف Traffic.
   *
   * Traffic فقط این مقدار را تغییر می‌دهد؛ خود حرکت با
   * acceleration/deceleration نرم انجام می‌شود.
   */
  targetSpeed: number;

  /**
   * زمان انتظار خودرو قبل از تقاطع.
   */
  intersectionWaitTime: number;

  /**
   * آیا خودرو در صف تقاطع قرار دارد؟
   */
  waitingAtIntersection: boolean;
}

/**
 * ==========================================
 * Vehicle Profile
 * ==========================================
 */
interface VehicleProfile {
  type: VehicleModelType;
  weight: number;
}

export default class CarManager {
  /**
   * ==========================================
   * Pool / Spawn
   * ==========================================
   */

  private static readonly POOL_SIZE = 160;

  /**
   * تعداد خودروهای اولیه داخل شهر.
   */
  private static readonly INITIAL_CARS = 60;

  /**
   * حداقل فاصله برای Spawn.
   */
  private static readonly MIN_SPAWN_DISTANCE = 8;

  /**
   * حداقل فاصله خودرو از دوربین هنگام Spawn/Reposition.
   *
   * خودرو باید قبل از ورود به محدوده دید دوربین، مدتی در شهر حرکت کرده باشد.
   */
  private static readonly SPAWN_MIN_CAMERA_DISTANCE = 24;

  /**
   * حداکثر فاصله ترجیحی برای Spawn/Reposition.
   *
   * باعث می‌شود خودروها بی‌جهت در فاصله‌های بسیار دور ایجاد نشوند.
   */
  private static readonly SPAWN_MAX_CAMERA_DISTANCE = 72;

  /**
   * تعداد نمونه‌های بررسی‌شده برای پیدا کردن نقطه امن روی هر Road.
   */
  private static readonly SPAWN_POSITION_SAMPLES: number = 7;

  /**
   * ==========================================
   * Continuous Traffic
   * ==========================================
   *
   * تعداد خودروهایی که باید تا زمانی که
   * سایت باز است در شهر فعال باشند.
   */
  private static readonly TARGET_ACTIVE_CARS = 60;

  /**
   * فاصله زمانی بین تلاش‌های پر کردن دوباره
   * ترافیک.
   */
  private static readonly REFILL_INTERVAL = 0.25;


  /**
   * ==========================================
   * Vehicle Following
   * ==========================================
   */

  /**
   * فاصله‌ای که خودرو جلویی از آن نزدیک‌تر
   * باشد، خودرو کاهش سرعت می‌دهد.
   */
  private static readonly FRONT_DETECTION_DISTANCE = 10;

  /**
   * فاصله امن پشت خودرو.
   */
  private static readonly SAFE_FOLLOW_DISTANCE = 5.5;

  /**
   * ==========================================
   * Physical Vehicle Collision
   * ==========================================
   *
   * فاصله حداقلی فیزیکی بین دو خودرو.
   */
  private static readonly VEHICLE_COLLISION_DISTANCE = 2.8;

  /**
   * چند ثانیه آینده برای پیش‌بینی برخورد
   * بررسی می‌شود.
   */
  private static readonly VEHICLE_PREDICTION_TIME = 0.12;

  /**
   * ==========================================
   * Lane Safety
   * ==========================================
   *
   * Lane 0:
   * -2 -> -1.5
   *
   * Lane 1:
   * +2 -> +1.5
   */
  private static readonly TRAFFIC_LANE_SAFETY_OFFSET = 0.5;

  /**
   * ارتفاع خودرو.
   */
  private static readonly VEHICLE_Y = 0.16;

  /**
   * ==========================================
   * Speed
   * ==========================================
   */

  private static readonly MIN_SPEED = 2.5;
  private static readonly MAX_SPEED = 5.5;

  /**
   * ==========================================
   * Smooth Vehicle Motion
   * ==========================================
   *
   * سرعت خودروها هیچ‌وقت به‌صورت ناگهانی از حرکت به توقف
   * یا از توقف به حرکت تغییر نمی‌کند.
   */
  private static readonly ACCELERATION = 4.5;
  private static readonly DECELERATION = 6.5;

  /**
   * ==========================================
   * Road / Transition
   * ==========================================
   */

  private static readonly ROAD_CONNECTION_DISTANCE = 5;

  private static readonly TRANSITION_TRIGGER_DISTANCE = 3.5;

  private static readonly TRANSITION_EXIT_DISTANCE = 3.5;

  private static readonly TURN_RADIUS = 3.25;

  private static readonly MIN_TRANSITION_DURATION = 0.28;

  private static readonly MAX_TRANSITION_DURATION = 1.1;

  /**
   * ==========================================
   * Intersection Rules
   * ==========================================
   */

  /**
   * فقط چند متر آخر قبل از تقاطع.
   */
  private static readonly INTERSECTION_APPROACH_DISTANCE = 4;

  /**
   * محدوده تشخیص اشغال بودن تقاطع.
   */
  private static readonly INTERSECTION_OCCUPANCY_DISTANCE = 6;


  /**
   * فاصله تشکیل صف.
   */
  private static readonly INTERSECTION_QUEUE_DISTANCE = 6;

  /**
   * ==========================================
   * Vehicle Profiles
   * ==========================================
   */

  private readonly vehicleProfiles: VehicleProfile[] = [
    { type: "taxi", weight: 10 },
    { type: "sedan", weight: 18 },
    { type: "sedan-sports", weight: 8 },
    { type: "hatchback-sports", weight: 8 },
    { type: "suv", weight: 10 },
    { type: "suv-luxury", weight: 5 },
    { type: "van", weight: 7 },
    { type: "delivery", weight: 7 },
    { type: "truck", weight: 4 },
    { type: "truck-flat", weight: 3 },
    { type: "police", weight: 2 },
    { type: "ambulance", weight: 1 },
    { type: "firetruck", weight: 1 },
    { type: "garbage-truck", weight: 2 },
    { type: "race", weight: 3 },
    { type: "race-future", weight: 2 },
    { type: "tractor", weight: 1 },
  ];

  /**
   * ==========================================
   * Runtime
   * ==========================================
   */

  private readonly vehicleFactory: VehicleFactory;

  private readonly availableVehicles: Vehicle[] = [];

  private readonly activeVehicles: ActiveVehicleData[] = [];

  /**
   * خودروهایی که به انتهای Road بدون اتصال رسیده‌اند.
   *
   * تا وقتی نقطه Spawn جایگزین پیدا نشود، خودرو از active list حذف نمی‌شود؛
   * بنابراین دیگر به‌صورت ناگهانی ناپدید نمی‌شود.
   */
  private readonly pendingRecycleVehicles = new Set<ActiveVehicleData>();

  private readonly roads: Road[] = [];

  private scene: THREE.Scene | null = null;

  /** Camera واقعی برای تشخیص Frustum و جلوگیری از Teleport داخل تصویر. */
  private camera: THREE.Camera | null = null;

  private initialCarsSpawned = false;

  private initialized = false;

  private initializing = false;

  /**
   * تایمر Continuous Traffic.
   */
  private refillTimer = 0;

  /**
   * آخرین موقعیت دوربین برای Spawn نامحسوس خودروهای Recycle شده.
   */
  private readonly lastCameraPosition = new THREE.Vector3();
  private hasCameraPosition = false;

  /**
   * ==========================================
   * Reusable Vectors
   * ==========================================
   *
   * برای جلوگیری از ایجاد Vector3های اضافی
   * در هر Frame.
   */

  private readonly tempLocalPosition = new THREE.Vector3();

  private readonly tempWorldPosition = new THREE.Vector3();

  private readonly tempDirection = new THREE.Vector3();

  private readonly tempIncoming = new THREE.Vector3();

  private readonly tempOutgoing = new THREE.Vector3();

  private readonly tempControl = new THREE.Vector3();

  /**
   * Vectorهای مخصوص Collision Detection.
   */
  private readonly tempOtherPosition = new THREE.Vector3();

  private readonly tempToOther = new THREE.Vector3();

  private readonly tempOtherDirection = new THREE.Vector3();

  private readonly tempRelativeVelocity = new THREE.Vector3();

  private readonly tempPredictedPosition = new THREE.Vector3();

  private readonly tempOtherPredictedPosition = new THREE.Vector3();

  /** Vector موقت برای Project کردن نقطه Spawn روی صفحه دوربین. */
  private readonly tempProjectedPosition = new THREE.Vector3();

  constructor() {
    this.vehicleFactory = new VehicleFactory();
  }

  /**
   * ==========================================
   * Initialize
   * ==========================================
   */

  public async initialize(scene: THREE.Scene): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;

    this.scene = scene;

    await this.buildVehiclePool();

    this.initialized = true;

    this.initializing = false;

    if (this.roads.length > 0) {
      this.spawnInitialCars();
    }
  }

  /**
   * ==========================================
   * Build Vehicle Pool
   * ==========================================
   */

  private async buildVehiclePool(): Promise<void> {
    if (!this.scene) {
      return;
    }

    while (this.availableVehicles.length < CarManager.POOL_SIZE) {
      const vehicleType = this.getRandomVehicleType();

      const vehicle =
        await this.vehicleFactory.createVehicle(vehicleType);

      vehicle.reset();

      this.scene.add(vehicle.group);

      vehicle.group.visible = false;

      this.availableVehicles.push(vehicle);
    }

    if (
      this.roads.length > 0 &&
      !this.initialCarsSpawned
    ) {
      this.spawnInitialCars();
    }
  }

  /**
   * ==========================================
   * Set Road Network
   * ==========================================
   */

  public setRoadNetwork(roads: Road[]): void {
    const validRoads = roads.filter(
      (road): road is Road => road instanceof Road,
    );

    let changed =
      validRoads.length !== this.roads.length;

    if (!changed) {
      for (
        let index = 0;
        index < validRoads.length;
        index++
      ) {
        if (
          validRoads[index] !==
          this.roads[index]
        ) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) {
      return;
    }

    this.roads.length = 0;

    this.roads.push(...validRoads);

    if (
      this.initialized &&
      !this.initialCarsSpawned &&
      this.roads.length > 0
    ) {
      this.spawnInitialCars();
    }

    if (this.roads.length === 0) {
      for (const active of this.activeVehicles) {
        active.vehicle.stop();
      }
    }
  }

  /**
   * ==========================================
   * Update
   * ==========================================
   */

  public update(
    cameraPosition: THREE.Vector3,
    deltaTime: number,
    camera?: THREE.Camera,
  ): void {
    // موقعیت دوربین را فقط یک‌بار در هر Frame ذخیره می‌کنیم تا Spawn مجدد
    // بتواند خودرو را خارج از محدوده دید مستقیم قرار دهد.
    this.lastCameraPosition.copy(cameraPosition);
    this.hasCameraPosition = true;

    // Camera واقعی را نگه می‌داریم تا Spawn/Reposition فقط بر اساس فاصله نباشد؛
    // نقطه باید واقعاً خارج از Frustum دوربین هم باشد.
    if (camera) {
      this.camera = camera;
      // ماتریس دوربین قبل از Project کردن نقاط Spawn به‌روز می‌شود.
      // این کار باعث می‌شود Frustum دقیقاً با نمای همان Frame هماهنگ باشد.
      this.camera.updateMatrixWorld();
    }
    if (!this.initialized) {
      return;
    }

    if (
      !this.initialCarsSpawned &&
      this.roads.length > 0
    ) {
      this.spawnInitialCars();
    }

    if (this.roads.length === 0) {
      return;
    }

    /**
     * ========================================
     * Continuous Traffic
     * ========================================
     *
     * فقط خودروهای اولیه یا جای خالی واقعی Pool را تکمیل می‌کنیم.
     * Recycle عادی دیگر از Pool استفاده نمی‌کند.
     */
    this.refillTimer += Math.max(0, deltaTime);

    // Pending Recycle هر Frame بررسی می‌شود تا انتقال به مقصد امن
    // با کمترین تأخیر ممکن انجام شود. این بخش فقط زمانی کار می‌کند
    // که واقعاً خودروی pending وجود داشته باشد.
    this.processPendingRecycles();

    if (
      this.refillTimer >=
      CarManager.REFILL_INTERVAL
    ) {
      this.refillTimer = 0;

      this.refillTraffic();
    }

    /**
     * ابتدا وضعیت تمام خودروها مشخص می‌شود.
     */
    this.updateTrafficState(deltaTime);

    /**
     * سپس حرکت خودروها انجام می‌شود.
     */
    for (
      let index =
        this.activeVehicles.length - 1;
      index >= 0;
      index--
    ) {
      const active =
        this.activeVehicles[index];

      if (!active) {
        continue;
      }

      /**
       * خودرو در حال Transition است.
       */
      if (active.trafficTransition) {
        this.updateTransition(
          active,
          deltaTime,
        );

        continue;
      }

      /**
       * ======================================
       * حرکت عادی خودرو
       * ======================================
       *
       * حرکت مستقیم اینجا انجام می‌شود تا منطق
       * Traffic Manager هیچ‌وقت به‌خاطر Collision
       * Guard خودروها را در یک نقطه قفل نکند.
       *
       * جهت‌ها همان mapping فعلی هستند و تغییر
       * نمی‌کنند؛ فقط position خودرو با سرعت فعلی
       * روی محور جهانی جلو می‌رود.
       */
      this.setDirectionVector(
        active.vehicle.getDirection(),
        this.tempDirection,
      );

      /**
       * سرعت را با شتاب/ترمز نرم به Target نزدیک می‌کنیم.
       *
       * نکته مهم:
       * حرکت Transform دیگر مستقیماً از getSpeed() داخلی Vehicle
       * استفاده نمی‌کند؛ بنابراین stop()/resume() داخلی نمی‌تواند
       * باعث پرش یا قطع و وصل موقعیت خودرو شود.
       */
      this.updateSmoothMotionSpeed(
        active,
        deltaTime,
      );

      const speed = active.motionSpeed;

      if (speed > 0.001) {
        active.vehicle.group.position.addScaledVector(
          this.tempDirection,
          speed * Math.max(0, deltaTime),
        );

        active.vehicle.group.position.y =
          CarManager.VEHICLE_Y;
      }

      /**
       * Target داخلی Vehicle نیز با سرعت نرم‌شده هماهنگ می‌شود
       * تا Animation/مدل خودرو با حرکت World از ریتم خارج نشود.
       */
      active.vehicle.setTargetSpeed(
        active.motionSpeed,
      );

      /**
       * بعد از حرکت موقعیت Road به‌روزرسانی
       * می‌شود.
       */
      this.updateRoadProgress(active);
    }
  }

  /**
   * ==========================================
   * Smooth Motion Speed
   * ==========================================
   *
   * سرعت World را به‌صورت exponential smoothing به Target نزدیک می‌کند.
   * این باعث می‌شود تغییرات FPS یا تغییر ناگهانی وضعیت Traffic باعث
   * پرش مکانی خودرو نشود.
   */
  private updateSmoothMotionSpeed(
    active: ActiveVehicleData,
    deltaTime: number,
  ): void {
    const dt = Math.min(
      Math.max(deltaTime, 0),
      0.05,
    );

    const current = active.motionSpeed;
    const target = Math.max(
      0,
      active.targetSpeed,
    );

    if (Math.abs(target - current) < 0.01) {
      active.motionSpeed = target;
      return;
    }

    const rate =
      target > current
        ? CarManager.ACCELERATION
        : CarManager.DECELERATION;

    const alpha =
      1 - Math.exp(-rate * dt);

    active.motionSpeed =
      THREE.MathUtils.lerp(
        current,
        target,
        alpha,
      );
  }

  /**
   * ==========================================
   * Continuous Traffic Refill
   * ==========================================
   *
   * تعداد خودروهای فعال را تا TARGET_ACTIVE_CARS
   * نگه می‌دارد.
   */
  private refillTraffic(): void {
    if (
      this.roads.length === 0 ||
      this.availableVehicles.length === 0
    ) {
      return;
    }

    const targetCount = Math.min(
      CarManager.TARGET_ACTIVE_CARS,
      CarManager.POOL_SIZE,
    );

    const missing =
      targetCount -
      this.activeVehicles.length;

    if (missing <= 0) {
      return;
    }

    let attempts = 0;

    const maxAttempts = Math.max(
      20,
      missing * 8,
    );

    while (
      this.activeVehicles.length <
        targetCount &&
      this.availableVehicles.length > 0 &&
      attempts < maxAttempts
    ) {
      attempts++;

      this.spawnCar(
        this.hasCameraPosition ? this.lastCameraPosition : undefined,
        this.hasCameraPosition,
      );
    }

    if (this.activeVehicles.length > 0) {
      this.initialCarsSpawned = true;
    }
  }

  /**
   * ==========================================
   * Initial Cars
   * ==========================================
   */

  private spawnInitialCars(): void {
    if (
      this.initialCarsSpawned ||
      this.roads.length === 0 ||
      this.availableVehicles.length === 0
    ) {
      return;
    }

    /**
     * Spawn اولیه عمداً به Camera وابسته نیست.
     *
     * نسخه قبلی برای اولین خودروها هم از Frustum/Off-screen Candidate
     * استفاده می‌کرد. در شهر Chunk-based ممکن بود هیچ Candidateای پیدا نشود
     * و در نتیجه Pool ساخته شود ولی حتی یک خودرو فعال نشود.
     *
     * اینجا ابتدا خودروها را روی Roadهای واقعی و با فاصله امن از یکدیگر
     * ایجاد می‌کنیم. منطق Off-screen فقط برای Recycle بعدی استفاده می‌شود.
     */
    const targetCount = Math.min(
      CarManager.INITIAL_CARS,
      this.availableVehicles.length,
    );

    let spawned = 0;
    let attempts = 0;
    const maxAttempts = Math.max(
      targetCount * 80,
      160,
    );

    while (
      spawned < targetCount &&
      attempts < maxAttempts &&
      this.availableVehicles.length > 0
    ) {
      attempts++;

      if (this.spawnInitialCar()) {
        spawned++;
      }
    }

    /**
     * حتی اگر به دلیل تراکم Roadها کمتر از هدف Spawn شد،
     * همان خودروهای فعال را معتبر می‌دانیم. Refill در Frameهای بعدی
     * باقی‌مانده Pool را به‌تدریج تکمیل می‌کند.
     */
    if (spawned > 0) {
      this.initialCarsSpawned = true;
    }
  }

  /**
   * ==========================================
   * Initial Spawn Car
   * ==========================================
   *
   * Spawn اولیه ساده و قابل اتکاست:
   * - فقط Road و Lane واقعی
   * - فاصله امن از خودروهای فعال
   * - بدون وابستگی به Camera Frustum
   *
   * این تابع فقط برای شروع Traffic است و Recycle را کنترل نمی‌کند.
   */
  private spawnInitialCar(): boolean {
    if (
      this.availableVehicles.length === 0 ||
      this.roads.length === 0
    ) {
      return false;
    }

    const roadIndex = Math.floor(
      Math.random() * this.roads.length,
    );

    const road = this.roads[roadIndex];

    if (!road) {
      return false;
    }

    const laneIndex = Math.floor(
      Math.random() * Road.LANE_COUNT,
    );

    const direction =
      this.getDirectionForRoad(
        road,
        laneIndex,
      );

    const roadDistance =
      this.getRandomSpawnDistance(road);

    if (
      !this.canSpawnCar(
        road,
        laneIndex,
        direction,
        roadDistance,
      )
    ) {
      return false;
    }

    return this.activateVehicleAt(
      road,
      laneIndex,
      direction,
      roadDistance,
    );
  }

  /**
   * ==========================================
   * Spawn Car
   * ==========================================
   */

  private spawnCar(
    cameraPosition?: THREE.Vector3,
    preferOffscreenSpawn = false,
  ): boolean {
    if (
      this.availableVehicles.length === 0 ||
      this.roads.length === 0
    ) {
      return false;
    }

    /**
     * Refill عادی ابتدا مقصد Off-screen را امتحان می‌کند.
     * اگر در شبکه فعلی هیچ Candidate امنی پیدا نشد، Traffic نباید متوقف شود؛
     * بنابراین به Spawn معمولی روی Road برمی‌گردیم.
     *
     * این fallback فقط برای جلوگیری از خالی شدن Traffic Pool است و
     * به Road، Lane یا جهت حرکت دست نمی‌زند.
     */
    if (
      cameraPosition &&
      preferOffscreenSpawn
    ) {
      const candidate =
        this.findOffscreenRecycleCandidate(
          cameraPosition,
          undefined,
        );

      if (candidate) {
        return this.activateVehicleAt(
          candidate.road,
          candidate.laneIndex,
          candidate.direction,
          candidate.distance,
        );
      }
    }

    /**
     * Fallback / Spawn معمولی.
     *
     * این مسیر عمداً مستقل از Camera است تا اگر Frustum یا Chunkهای فعال
     * Candidate مناسبی ندادند، خودروها همچنان ساخته شوند.
     */
    const maxAttempts = Math.min(
      24,
      Math.max(
        8,
        this.roads.length * 2,
      ),
    );

    for (
      let attempt = 0;
      attempt < maxAttempts;
      attempt++
    ) {
      const roadIndex = Math.floor(
        Math.random() * this.roads.length,
      );

      const road = this.roads[roadIndex];

      if (!road) {
        continue;
      }

      const laneIndex = Math.floor(
        Math.random() * Road.LANE_COUNT,
      );

      const direction =
        this.getDirectionForRoad(
          road,
          laneIndex,
        );

      const roadDistance =
        this.getRandomSpawnDistance(road);

      if (
        !this.canSpawnCar(
          road,
          laneIndex,
          direction,
          roadDistance,
        )
      ) {
        continue;
      }

      if (
        this.activateVehicleAt(
          road,
          laneIndex,
          direction,
          roadDistance,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * ==========================================
   * Activate Vehicle At
   * ==========================================
   *
   * تنها نقطه‌ای که Vehicle تازه از Pool خارج می‌شود.
   *
   * مهم: Recycle فعال‌ها از این تابع استفاده نمی‌کند؛
   * Recycle فقط Transform خودرو فعال را جابه‌جا می‌کند.
   */
  private activateVehicleAt(
    road: Road,
    laneIndex: number,
    direction: VehicleDirection,
    roadDistance: number,
  ): boolean {
    const vehicle =
      this.availableVehicles.pop();

    if (!vehicle) {
      return false;
    }

    const position =
      this.getVehicleWorldPosition(
        road,
        laneIndex,
        roadDistance,
      );

    const cruiseSpeed =
      this.getRandomSpeed();

    vehicle.activate(
      position,
      direction,
      cruiseSpeed,
    );

    vehicle.group.visible = true;

    this.activeVehicles.push({
      vehicle,
      road,
      laneIndex,
      roadDistance,
      trafficTransition: null,
      cruiseSpeed,
      motionSpeed: cruiseSpeed,
      targetSpeed: cruiseSpeed,
      intersectionWaitTime: 0,
      waitingAtIntersection: false,
    });

    return true;
  }

  /**
   * ==========================================
   * Random Spawn Distance
   * ==========================================
   */

  /**
   * ==========================================
   * Offscreen Recycle Spawn Distance
   * ==========================================
   *
   * برای خودروهایی که به انتهای Road رسیده‌اند، نقطه Spawn را از بین
   * دو سر Road انتخاب می‌کنیم؛ فقط نقطه‌ای پذیرفته می‌شود که از دوربین
   * به اندازه کافی دور باشد.
   *
   * این منطق فقط برای Recycle است و منطق حرکت خودروها را تغییر نمی‌دهد.
   */
  private getRandomSpawnDistance(
    road: Road,
  ): number {
    const min =
      road.getLongitudinalMin() +
      CarManager.TRANSITION_EXIT_DISTANCE;

    const max =
      road.getLongitudinalMax() -
      CarManager.TRANSITION_EXIT_DISTANCE;

    if (max <= min) {
      return (
        road.getLongitudinalMin() +
        road.getLongitudinalMax()
      ) / 2;
    }

    return (
      min +
      Math.random() * (max - min)
    );
  }

  /**
   * ==========================================
   * Vehicle World Position
   * ==========================================
   *
   * Lane 0:
   * -2 -> -1.5
   *
   * Lane 1:
   * +2 -> +1.5
   *
   * این بخش حفظ شده است.
   */

  private getVehicleWorldPosition(
    road: Road,
    laneIndex: number,
    roadDistance: number,
  ): THREE.Vector3 {
    const lanePosition =
      road.getLanePosition(
        laneIndex,
        roadDistance,
      );

    this.tempLocalPosition.copy(
      lanePosition,
    );

    if (laneIndex === 0) {
      this.tempLocalPosition.x +=
        CarManager.TRAFFIC_LANE_SAFETY_OFFSET;
    } else if (laneIndex === 1) {
      this.tempLocalPosition.x -=
        CarManager.TRAFFIC_LANE_SAFETY_OFFSET;
    }

    this.tempWorldPosition.copy(
      this.tempLocalPosition,
    );

    road.group.localToWorld(
      this.tempWorldPosition,
    );

    this.tempWorldPosition.y =
      CarManager.VEHICLE_Y;

    return this.tempWorldPosition;
  }

  /**
   * ==========================================
   * Spawn Validation
   * ==========================================
   */

  private canSpawnCar(
    road: Road,
    laneIndex: number,
    direction: VehicleDirection,
    roadDistance: number,
    ignoredVehicle?: ActiveVehicleData,
  ): boolean {
    for (const active of this.activeVehicles) {
      // هنگام Recycle همان Vehicle دوباره استفاده می‌شود؛ خودش نباید
      // به‌عنوان مانع مقصد جدید خودش محاسبه شود.
      if (active === ignoredVehicle) {
        continue;
      }
      /**
       * خودروهای همان Lane.
       */
      if (
        active.road === road &&
        active.laneIndex === laneIndex
      ) {
        const distance =
          this.getForwardDistance(
            road,
            roadDistance,
            active.roadDistance,
            direction,
          );

        if (
          distance >= 0 &&
          distance <
            CarManager.MIN_SPAWN_DISTANCE
        ) {
          return false;
        }

        if (
          Math.abs(
            roadDistance -
              active.roadDistance,
          ) <
            CarManager.MIN_SPAWN_DISTANCE
        ) {
          return false;
        }
      }

      /**
       * مقصد Transition.
       */
      const transition =
        active.trafficTransition;

      if (
        transition &&
        transition.toRoad === road &&
        transition.toLaneIndex ===
          laneIndex
      ) {
        const distance =
          this.getForwardDistance(
            road,
            roadDistance,
            transition.finalDistance,
            direction,
          );

        if (
          distance >= 0 &&
          distance <
            CarManager.MIN_SPAWN_DISTANCE
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * ==========================================
   * Physical Collision Guard
   * ==========================================
   *
   * این متد مشکل قبلی را حل می‌کند:
   *
   * 1. اگر خودرو واقعاً بیش از حد نزدیک باشد
   *    متوقف می‌شود.
   *
   * 2. اگر خودرو در مسیر مستقیم برخورد باشد،
   *    قبل از برخورد متوقف می‌شود.
   *
   * 3. خودروهایی که پشت سر خودرو هستند
   *    باعث توقف بی‌دلیل آن نمی‌شوند.
   *
   * 4. خودروهای Transition نیز در محاسبه
   *    لحاظ می‌شوند.
   */

  private isVehicleMovementBlocked(
    active: ActiveVehicleData,
    deltaTime: number,
  ): boolean {
    const vehicle = active.vehicle;

    const currentPosition =
      vehicle.group.position;

    const speed = active.motionSpeed;

    if (speed <= 0.001) {
      return false;
    }

    /**
     * جهت حرکت خودروی فعلی.
     */
    this.setDirectionVector(
      vehicle.getDirection(),
      this.tempDirection,
    );

    /**
     * موقعیت پیش‌بینی‌شده خودروی فعلی.
     */
    const predictionTime = Math.min(
      Math.max(deltaTime, 0),
      CarManager.VEHICLE_PREDICTION_TIME,
    );

    this.tempPredictedPosition
      .copy(currentPosition)
      .addScaledVector(
        this.tempDirection,
        Math.max(
          speed * predictionTime,
          0.05,
        ),
      );

    for (const other of this.activeVehicles) {
      if (other === active) {
        continue;
      }

      const otherPosition =
        other.vehicle.group.position;

      /**
       * --------------------------------------
       * فاصله فعلی
       * --------------------------------------
       */

      const currentDistance =
        currentPosition.distanceTo(
          otherPosition,
        );

      /**
       * اگر همین حالا خیلی نزدیک هستند،
       * اجازه حرکت بیشتر داده نمی‌شود.
       */
      if (
        currentDistance <=
        CarManager.VEHICLE_COLLISION_DISTANCE
      ) {
        /**
         * فقط وقتی خودرو جلویی/مسیر برخورد
         * است متوقف می‌کنیم.
         */
        this.tempToOther
          .copy(otherPosition)
          .sub(currentPosition);

        const forwardDistance =
          this.tempToOther.dot(
            this.tempDirection,
          );

        if (forwardDistance >= 0) {
          return true;
        }

        /**
         * اگر خودروی دیگر در حال حرکت به سمت
         * ما باشد، آن را نیز به‌عنوان خطر
         * در نظر می‌گیریم.
         */
        if (
          other.trafficTransition ||
          other.motionSpeed >
            0.001
        ) {
          this.setDirectionVector(
            other.vehicle.getDirection(),
            this.tempOtherDirection,
          );

          const otherClosing =
            this.tempOtherDirection.dot(
              this.tempToOther,
            );

          if (otherClosing < 0) {
            return true;
          }
        }
      }

      /**
       * --------------------------------------
       * فقط خودروهای جلویی
       * --------------------------------------
       */

      this.tempToOther
        .copy(otherPosition)
        .sub(currentPosition);

      const forwardDistance =
        this.tempToOther.dot(
          this.tempDirection,
        );

      /**
       * خودروی پشت سر باعث توقف این خودرو
       * نمی‌شود.
       */
      if (forwardDistance < 0) {
        continue;
      }

      /**
       * فاصله جانبی.
       *
       * اگر خودرو روی مسیر دیگری باشد،
       * Collision Guard نباید آن را متوقف کند.
       */
      const longitudinalDistance =
        forwardDistance;

      const lateralDistanceSquared =
        Math.max(
          0,
          this.tempToOther.lengthSq() -
            longitudinalDistance *
              longitudinalDistance,
        );

      /**
       * برای خودروهای همین مسیر،
       * بررسی دقیق‌تر انجام می‌دهیم.
       */
      const sameTrafficPath =
        lateralDistanceSquared <=
        CarManager.VEHICLE_COLLISION_DISTANCE *
          CarManager.VEHICLE_COLLISION_DISTANCE;

      if (!sameTrafficPath) {
        continue;
      }

      /**
       * --------------------------------------
       * پیش‌بینی موقعیت خودرو جلویی
       * --------------------------------------
       */

      const otherSpeed =
        other.motionSpeed;

      this.setDirectionVector(
        other.vehicle.getDirection(),
        this.tempOtherDirection,
      );

      this.tempOtherPredictedPosition
        .copy(otherPosition)
        .addScaledVector(
          this.tempOtherDirection,
          Math.max(
            otherSpeed *
              predictionTime,
            0,
          ),
        );

      const predictedDistance =
        this.tempPredictedPosition.distanceTo(
          this.tempOtherPredictedPosition,
        );

      /**
       * اگر در Frame بعدی فاصله کمتر از
       * محدوده برخورد شود، جلویی را رد نمی‌کنیم.
       */
      if (
        predictedDistance <=
        CarManager.VEHICLE_COLLISION_DISTANCE
      ) {
        return true;
      }

      /**
       * اگر فاصله خیلی کم است و خودرو جلویی
       * سرعت کمتری دارد، توقف لازم است.
       */
      if (
        longitudinalDistance <=
          CarManager.SAFE_FOLLOW_DISTANCE &&
        otherSpeed <= speed
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * ==========================================
   * Traffic State
   * ==========================================
   */

  private updateTrafficState(
    deltaTime: number,
  ): void {
    const dt = Math.min(
      Math.max(deltaTime, 0),
      0.1,
    );

    for (const active of this.activeVehicles) {
      if (active.trafficTransition) {
        continue;
      }

      /**
       * خودروهایی که به انتهای یک Road بدون اتصال رسیده‌اند،
       * تا وقتی هنوز داخل محدوده دید دوربین هستند نباید Teleport شوند.
       *
       * در نسخه قبلی، Candidate مقصد بلافاصله پیدا می‌شد و خودرو همان
       * Frame به یک نقطه دور منتقل می‌شد؛ نتیجه از دید کاربر مثل
       * ناپدید شدن/چشمک زدن خودرو بعد از حدود چند ثانیه بود.
       *
       * اینجا خودرو موقتاً نرم می‌ایستد و Recycle فقط وقتی انجام می‌شود
       * که خود خودرو از محدوده امن تصویر خارج شده باشد.
       */
      if (this.pendingRecycleVehicles.has(active)) {
        active.waitingAtIntersection = false;
        active.targetSpeed = 0;
        continue;
      }

      const vehicle = active.vehicle;
      const approach =
        this.getIntersectionApproachInfo(active);

      active.intersectionWaitTime = approach
        ? active.intersectionWaitTime + dt
        : 0;

      active.waitingAtIntersection = false;

      // به‌صورت پیش‌فرض خودرو می‌خواهد با سرعت طبیعی خودش حرکت کند.
      active.targetSpeed = active.cruiseSpeed;

      // خودرو جلویی را فقط روی همان Road و همان Lane بررسی می‌کنیم.
      let nearestFrontDistance = Infinity;

      for (const other of this.activeVehicles) {
        if (
          other === active ||
          other.trafficTransition
        ) {
          continue;
        }

        if (
          other.road !== active.road ||
          other.laneIndex !== active.laneIndex
        ) {
          continue;
        }

        const distance =
          this.getForwardDistance(
            active.road,
            active.roadDistance,
            other.roadDistance,
            vehicle.getDirection(),
          );

        if (
          distance >= 0 &&
          distance < nearestFrontDistance
        ) {
          nearestFrontDistance = distance;
        }
      }

      // خودرویی که در Transition وارد همین Lane می‌شود نیز مانع محسوب می‌شود.
      for (const other of this.activeVehicles) {
        if (
          other === active ||
          !other.trafficTransition
        ) {
          continue;
        }

        const transition =
          other.trafficTransition;

        if (
          transition.toRoad !== active.road ||
          transition.toLaneIndex !==
            active.laneIndex
        ) {
          continue;
        }

        const distance =
          this.getForwardDistance(
            active.road,
            active.roadDistance,
            transition.finalDistance,
            vehicle.getDirection(),
          );

        if (
          distance >= 0 &&
          distance < nearestFrontDistance
        ) {
          nearestFrontDistance = distance;
        }
      }

      /**
       * فاصله خیلی کم:
       * Target را صفر می‌کنیم، اما Vehicle را stop نمی‌کنیم.
       *
       * بنابراین motionSpeed به‌صورت نرم پایین می‌آید.
       */
      if (
        nearestFrontDistance <=
        CarManager.SAFE_FOLLOW_DISTANCE
      ) {
        active.targetSpeed = 0;
        continue;
      }

      /**
       * خودرو جلوتر نزدیک است:
       * سرعت هدف را متناسب با فاصله کم می‌کنیم.
       */
      if (
        nearestFrontDistance <=
        CarManager.FRONT_DETECTION_DISTANCE
      ) {
        const ratio = Math.max(
          0,
          Math.min(
            1,
            (nearestFrontDistance -
              CarManager.SAFE_FOLLOW_DISTANCE) /
              (CarManager.FRONT_DETECTION_DISTANCE -
                CarManager.SAFE_FOLLOW_DISTANCE),
          ),
        );

        active.targetSpeed =
          active.cruiseSpeed * ratio;

        continue;
      }

      // تقاطع خالی نباید خودرو را بی‌دلیل متوقف کند.
      if (approach) {
        const occupied =
          this.isIntersectionOccupied(active);

        const conflict =
          this.hasIntersectionPriorityBlocker(
            active,
          );

        if (occupied || conflict) {
          active.waitingAtIntersection = true;
          active.targetSpeed = 0;
          continue;
        }
      }

      active.intersectionWaitTime = 0;
      active.waitingAtIntersection = false;
    }
  }

  /**
   * ==========================================
   * Intersection Priority Blocker
   * ==========================================
   */

  private hasIntersectionPriorityBlocker(
    active: ActiveVehicleData,
  ): boolean {
    const approach = this.getIntersectionApproachInfo(active);
    if (!approach) return false;

    for (const other of this.activeVehicles) {
      if (other === active || other.trafficTransition) continue;

      const otherApproach = this.getIntersectionApproachInfo(other);
      if (!otherApproach) continue;

      const sameIntersection = approach.connectionPoint.distanceTo(otherApproach.connectionPoint) <= 2.5;
      if (!sameIntersection) continue;

      // خودرویی که زودتر به مرکز تقاطع رسیده، حق عبور خود را حفظ می‌کند.
      // این ترتیب زمانی است، نه ترتیب index آرایه.
      const activeRemaining = approach.remaining;
      const otherRemaining = otherApproach.remaining;

      if (otherRemaining < activeRemaining - 0.25) {
        return true;
      }
    }

    return false;
  }

  /**
   * ==========================================
   * Intersection Occupancy
   * ==========================================
   */

  private isIntersectionOccupied(
    active: ActiveVehicleData,
  ): boolean {
    const approach = this.getIntersectionApproachInfo(active);
    if (!approach) return false;

    for (const other of this.activeVehicles) {
      if (other === active) continue;

      const position = other.vehicle.group.position;
      const distance = approach.connectionPoint.distanceTo(position);

      // خودروهای داخل خود تقاطع یا Transition نزدیک آن، مانع هستند.
      if (distance <= CarManager.INTERSECTION_OCCUPANCY_DISTANCE) {
        return true;
      }

      const transition = other.trafficTransition;
      if (transition) {
        const transitionDistance = approach.connectionPoint.distanceTo(transition.end);
        if (transitionDistance <= CarManager.INTERSECTION_OCCUPANCY_DISTANCE) return true;
      }
    }

    return false;
  }

  /**
   * ==========================================
   * Intersection Approach Info
   * ==========================================
   */

  private getIntersectionApproachInfo(
    active: ActiveVehicleData,
  ): {
    remaining: number;
    connectionPoint: THREE.Vector3;
  } | null {
    const direction = active.vehicle.getDirection();
    const movingPositive = this.isMovingPositive(direction);
    const endpointDistance = movingPositive
      ? active.road.getLongitudinalMax()
      : active.road.getLongitudinalMin();

    const remaining = movingPositive
      ? endpointDistance - active.roadDistance
      : active.roadDistance - endpointDistance;

    if (remaining < 0 || remaining > CarManager.INTERSECTION_APPROACH_DISTANCE) {
      return null;
    }

    const connectionPoint = this.getVehicleWorldPosition(
      active.road,
      active.laneIndex,
      endpointDistance,
    ).clone();

    return { remaining, connectionPoint };
  }

  /**
   * ==========================================
   * Forward Distance
   * ==========================================
   */

  private getForwardDistance(
    _road: Road,
    currentDistance: number,
    otherDistance: number,
    direction: VehicleDirection,
  ): number {
    // Roadها finite هستند؛ wrap کردن فاصله باعث می‌شد خودرو انتهای Road را
    // به اشتباه به‌عنوان خودروی جلویی در ابتدای همان Road ببیند.
    // در Vehicle.ts:
    // north  => z-
    // south  => z+
    // east   => x+
    // west   => x-
    // بنابراین north و west روی محور طولی Road در جهت منفی حرکت می‌کنند.
    return direction === "south" || direction === "east"
      ? otherDistance - currentDistance
      : currentDistance - otherDistance;
  }

  /**
   * ==========================================
   * Road Progress
   * ==========================================
   */

  private updateRoadProgress(
    active: ActiveVehicleData,
  ): void {
    const vehicle = active.vehicle;

    const road = active.road;

    this.tempLocalPosition.copy(
      vehicle.group.position,
    );

    road.group.worldToLocal(
      this.tempLocalPosition,
    );

    active.roadDistance =
      this.tempLocalPosition.z;

    const movingPositive =
      this.isMovingPositive(
        vehicle.getDirection(),
      );

    const roadEnd = movingPositive
      ? road.getLongitudinalMax()
      : road.getLongitudinalMin();

    const remaining = movingPositive
      ? roadEnd -
        active.roadDistance
      : active.roadDistance -
        roadEnd;

    if (
      remaining <=
      CarManager.TRANSITION_TRIGGER_DISTANCE
    ) {
      const transitioned =
        this.tryStartRoadTransition(
          active,
          movingPositive,
        );

      if (!transitioned) {
        // اگر Road متصل واقعی وجود ندارد، خودرو نباید U-turn کند.
        // آن را از Traffic آزاد می‌کنیم تا دوباره از Spawn وارد شهر شود.
        const index = this.activeVehicles.indexOf(active);
        if (index >= 0) {
          this.recycleVehicle(index);
        }
      }
    }
  }

  /**
   * ==========================================
   * Road Transition
   * ==========================================
   */

  private tryStartRoadTransition(
    active: ActiveVehicleData,
    movingPositive: boolean,
  ): boolean {
    const candidates =
      this.findConnectedRoads(
        active.road,
        movingPositive,
        active.vehicle.getDirection(),
      );

    if (candidates.length === 0) {
      return false;
    }

    const selected =
      this.selectConnectedRoad(
        candidates,
        active.vehicle.getDirection(),
      );

    if (!selected) {
      return false;
    }

    const nextDirection =
      this.getDirectionForEndpoint(
        selected.road,
        selected.endpointIsMin,
      );

    const nextLaneIndex =
      this.getLaneIndexForDirection(
        selected.road,
        nextDirection,
      );

    const nextDistance =
      selected.endpointIsMin
        ? selected.road.getLongitudinalMin() +
          CarManager.TRANSITION_EXIT_DISTANCE
        : selected.road.getLongitudinalMax() -
          CarManager.TRANSITION_EXIT_DISTANCE;

    const start =
      active.vehicle.group.position.clone();

    const end =
      this.getVehicleWorldPosition(
        selected.road,
        nextLaneIndex,
        nextDistance,
      );

    const control =
      this.createTransitionControlPoint(
        selected.connectionPoint,
        active.vehicle.getDirection(),
        nextDirection,
      );

    const distance =
      start.distanceTo(end);

    const duration = Math.max(
      CarManager.MIN_TRANSITION_DURATION,
      Math.min(
        CarManager.MAX_TRANSITION_DURATION,
        distance /
          Math.max(
            active.motionSpeed,
            CarManager.MIN_SPEED,
          ),
      ),
    );

    active.trafficTransition = {
      fromRoad: active.road,
      toRoad: selected.road,
      fromLaneIndex: active.laneIndex,
      toLaneIndex: nextLaneIndex,
      start: start.clone(),
      control: control.clone(),
      end: end.clone(),
      finalDirection: nextDirection,
      finalDistance: nextDistance,
      elapsed: 0,
      duration,
    };

    // Transition با Bezier جداگانه حرکت می‌کند؛ فقط سرعت داخلی Vehicle
    // را برای Animation به صفر نزدیک می‌کنیم و خود Transform توسط
    // updateTransition کنترل می‌شود.
    active.targetSpeed = 0;
    active.vehicle.setTargetSpeed(0);

    return true;
  }

  /**
   * ==========================================
   * Find Connected Roads
   * ==========================================
   */

  private findConnectedRoads(
    fromRoad: Road,
    movingPositive: boolean,
    currentDirection: VehicleDirection,
  ): Array<{
    road: Road;
    endpointIsMin: boolean;
    connectionPoint: THREE.Vector3;
  }> {
    const candidates: Array<{
      road: Road;
      endpointIsMin: boolean;
      connectionPoint: THREE.Vector3;
    }> = [];

    const endpointDistance = movingPositive
      ? fromRoad.getLongitudinalMax()
      : fromRoad.getLongitudinalMin();

    // اتصال باید از همان Lane فعلی سنجیده شود؛ Lane صفر برای همه خودروها غلط است.
    const fromLane = this.getLaneIndexForDirection(fromRoad, currentDirection);
    const sourcePoint = this.getVehicleWorldPosition(
      fromRoad, fromLane, endpointDistance,
    ).clone();

    for (const road of this.roads) {
      if (road === fromRoad) continue;

      for (const endpointIsMin of [true, false]) {
        const nextDirection = this.getDirectionForEndpoint(road, endpointIsMin);
        if (this.isUTurn(currentDirection, nextDirection)) continue;

        const nextLane = this.getLaneIndexForDirection(road, nextDirection);
        const endpointDistance = endpointIsMin
          ? road.getLongitudinalMin()
          : road.getLongitudinalMax();
        const endpointPoint = this.getVehicleWorldPosition(
          road, nextLane, endpointDistance,
        ).clone();

        if (sourcePoint.distanceTo(endpointPoint) <= CarManager.ROAD_CONNECTION_DISTANCE) {
          candidates.push({
            road,
            endpointIsMin,
            connectionPoint: sourcePoint.clone().lerp(endpointPoint, 0.5),
          });
        }
      }
    }

    return candidates;
  }

  /**
   * ==========================================
   * Select Connected Road
   * ==========================================
   */

  private selectConnectedRoad(
    candidates: Array<{
      road: Road;
      endpointIsMin: boolean;
      connectionPoint: THREE.Vector3;
    }>,
    currentDirection: VehicleDirection,
  ): {
    road: Road;
    endpointIsMin: boolean;
    connectionPoint: THREE.Vector3;
  } | null {
    if (candidates.length === 0) {
      return null;
    }

    const straightCandidates =
      candidates.filter(
        (candidate) => {
          const direction =
            this.getDirectionForEndpoint(
              candidate.road,
              candidate.endpointIsMin,
            );

          return this.isSameAxis(
            currentDirection,
            direction,
          );
        },
      );

    if (
      straightCandidates.length > 0 &&
      Math.random() < 0.55
    ) {
      const index = Math.floor(
        Math.random() *
          straightCandidates.length,
      );

      return (
        straightCandidates[index] ??
        null
      );
    }

    const index = Math.floor(
      Math.random() * candidates.length,
    );

    return candidates[index] ?? null;
  }

  /**
   * ==========================================
   * Endpoint Direction
   * ==========================================
   *
   * جهت‌ها دقیقاً حفظ شده‌اند.
   */

  private getDirectionForEndpoint(
    road: Road,
    endpointIsMin: boolean,
  ): VehicleDirection {
    const worldDirection = road.getWorldDirection();
    const horizontal = Math.abs(worldDirection.x) >= Math.abs(worldDirection.z);

    if (horizontal) {
      // getWorldDirection() جهت +Z محلی Road را نشان می‌دهد.
      // اگر +Z محلی به سمت +X باشد، min=-X (west) و max=+X (east) است.
      // اگر +Z محلی به سمت -X باشد، این دو برعکس می‌شوند.
      if (worldDirection.x >= 0) {
        return endpointIsMin
          ? "west"
          : "east";
      }

      return endpointIsMin
        ? "east"
        : "west";
    }

    // در محور عمودی، +Z محلی اگر به سمت +Z جهانی باشد:
    // min=-Z => north و max=+Z => south.
    if (worldDirection.z >= 0) {
      return endpointIsMin
        ? "north"
        : "south";
    }

    return endpointIsMin
      ? "south"
      : "north";
  }

  /**
   * ==========================================
   * Lane Index From Direction
   * ==========================================
   */

  private getLaneIndexForDirection(
    road: Road,
    direction: VehicleDirection,
  ): number {
    const worldDirection = road.getWorldDirection();
    const horizontal = Math.abs(worldDirection.x) >= Math.abs(worldDirection.z);

    if (horizontal) {
      return direction === "east"
        ? 0
        : 1;
    }

    return direction === "north"
      ? 0
      : 1;
  }

  /**
   * ==========================================
   * Direction From Road
   * ==========================================
   */

  private getDirectionForRoad(
    road: Road,
    laneIndex: number,
  ): VehicleDirection {
    const worldDirection = road.getWorldDirection();
    const horizontal = Math.abs(worldDirection.x) >= Math.abs(worldDirection.z);

    if (horizontal) {
      return laneIndex === 0
        ? "east"
        : "west";
    }

    return laneIndex === 0
      ? "north"
      : "south";
  }

  /**
   * ==========================================
   * Transition Control Point
   * ==========================================
   */

  private createTransitionControlPoint(
    connectionPoint: THREE.Vector3,
    incomingDirection: VehicleDirection,
    outgoingDirection: VehicleDirection,
  ): THREE.Vector3 {
    this.setDirectionVector(
      incomingDirection,
      this.tempIncoming,
    );

    this.setDirectionVector(
      outgoingDirection,
      this.tempOutgoing,
    );

    /**
     * U-Turn.
     */
    if (
      this.tempIncoming.dot(
        this.tempOutgoing,
      ) < -0.9
    ) {
      this.tempControl
        .copy(connectionPoint)
        .addScaledVector(
          this.tempIncoming,
          -CarManager.TURN_RADIUS,
        );

      return this.tempControl;
    }

    this.tempControl
      .copy(connectionPoint)
      .addScaledVector(
        this.tempIncoming,
        CarManager.TURN_RADIUS,
      )
      .addScaledVector(
        this.tempOutgoing,
        CarManager.TURN_RADIUS,
      )
      .multiplyScalar(0.5);

    return this.tempControl;
  }

  /**
   * ==========================================
   * Update Transition
   * ==========================================
   */

  private updateTransition(
    active: ActiveVehicleData,
    deltaTime: number,
  ): void {
    const transition =
      active.trafficTransition;

    if (!transition) {
      return;
    }

    transition.elapsed += deltaTime;

    const progress = Math.min(
      1,
      transition.elapsed /
        transition.duration,
    );

    /**
     * Smoothstep.
     */
    const smoothProgress =
      progress *
      progress *
      (3 - 2 * progress);

    /**
     * حرکت روی منحنی درجه دو Bézier؛ به جای lerp مستقیم،
     * مسیر واقعی پیچ را دنبال می‌کنیم تا خودرو از وسط تقاطع عبور کند.
     */
    const t = smoothProgress;
    const oneMinusT = 1 - t;
    this.tempWorldPosition
      .copy(transition.start)
      .multiplyScalar(oneMinusT * oneMinusT)
      .addScaledVector(transition.control, 2 * oneMinusT * t)
      .addScaledVector(transition.end, t * t);

    active.vehicle.group.position.copy(
      this.tempWorldPosition,
    );

    active.vehicle.group.position.y =
      CarManager.VEHICLE_Y;

    /**
     * جهت مدل.
     */
    this.tempDirection
      .copy(transition.control)
      .sub(transition.start)
      .multiplyScalar(2 * (1 - t))
      .add(
        this.tempOutgoing.copy(transition.end).sub(transition.control).multiplyScalar(2 * t),
      );

    this.tempDirection.y = 0;

    if (
      this.tempDirection.lengthSq() >
      0.0001
    ) {
      this.tempDirection.normalize();

      active.vehicle.group.rotation.y =
        Math.atan2(
          this.tempDirection.x,
          this.tempDirection.z,
        );
    }

    /**
     * پایان Transition.
     */
    if (progress >= 1) {
      this.finishTransition(active);
    }
  }

  /**
   * ==========================================
   * Finish Transition
   * ==========================================
   */

  private finishTransition(
    active: ActiveVehicleData,
  ): void {
    const transition =
      active.trafficTransition;

    if (!transition) {
      return;
    }

    active.road =
      transition.toRoad;

    active.laneIndex =
      transition.toLaneIndex;

    active.roadDistance =
      transition.finalDistance;

    active.trafficTransition = null;

    /**
     * Direction mapping فعلی.
     */
    active.vehicle.setDirection(
      transition.finalDirection,
    );

    active.vehicle.group.position.copy(
      transition.end,
    );

    active.vehicle.group.position.y =
      CarManager.VEHICLE_Y;

    /**
     * تایمر تقاطع Road جدید.
     */
    active.intersectionWaitTime = 0;

    active.waitingAtIntersection = false;

    /**
     * ادامه حرکت با همان Cruise Speed.
     *
     * سرعت تصادفی جدید در هر تقاطع باعث تغییر ناگهانی ریتم Traffic
     * می‌شد؛ بنابراین سرعت طبیعی خودرو در طول عمر آن حفظ می‌شود.
     */
    active.targetSpeed = active.cruiseSpeed;
    active.vehicle.setTargetSpeed(
      active.motionSpeed,
    );
  }

  /**
   * ==========================================
   * Direction Vector
   * ==========================================
   *
   * این mapping عمداً تغییر نکرده است.
   */

  private setDirectionVector(
    direction: VehicleDirection,
    target: THREE.Vector3,
  ): void {
    target.set(0, 0, 0);

    switch (direction) {
      case "north":
        // Vehicle به سمت -Z حرکت می‌کند.
        target.z = -1;
        break;

      case "south":
        // Vehicle به سمت +Z حرکت می‌کند.
        target.z = 1;
        break;

      case "east":
        target.x = 1;
        break;

      case "west":
        target.x = -1;
        break;
    }
  }

  /**
   * ==========================================
   * Moving Positive
   * ==========================================
   */

  private isMovingPositive(
    direction: VehicleDirection,
  ): boolean {
    // جهت‌هایی که روی محور طولی محلی Road به سمت +Z حرکت می‌کنند.
    // north در Vehicle.ts به سمت -Z حرکت می‌کند، بنابراین مثبت نیست.
    return (
      direction === "south" ||
      direction === "east"
    );
  }

  /**
   * ==========================================
   * U-Turn Detection
   * ==========================================
   */

  private isUTurn(
    incoming: VehicleDirection,
    outgoing: VehicleDirection,
  ): boolean {
    return (
      (incoming === "north" &&
        outgoing === "south") ||
      (incoming === "south" &&
        outgoing === "north") ||
      (incoming === "east" &&
        outgoing === "west") ||
      (incoming === "west" &&
        outgoing === "east")
    );
  }

  /**
   * ==========================================
   * Same Axis
   * ==========================================
   */

  private isSameAxis(
    first: VehicleDirection,
    second: VehicleDirection,
  ): boolean {
    const firstHorizontal =
      first === "east" ||
      first === "west";

    const secondHorizontal =
      second === "east" ||
      second === "west";

    return (
      firstHorizontal ===
      secondHorizontal
    );
  }

  /**
   * ==========================================
   * Random Vehicle Type
   * ==========================================
   */

  private getRandomVehicleType(): VehicleModelType {
    let totalWeight = 0;

    for (const profile of this.vehicleProfiles) {
      totalWeight += profile.weight;
    }

    let random =
      Math.random() * totalWeight;

    for (const profile of this.vehicleProfiles) {
      random -= profile.weight;

      if (random <= 0) {
        return profile.type;
      }
    }

    const fallback =
      this.vehicleProfiles[
        this.vehicleProfiles.length - 1
      ];

    return fallback
      ? fallback.type
      : "sedan";
  }

  /**
   * ==========================================
   * Random Speed
   * ==========================================
   */

  private getRandomSpeed(): number {
    return (
      CarManager.MIN_SPEED +
      Math.random() *
        (CarManager.MAX_SPEED -
          CarManager.MIN_SPEED)
    );
  }

  /**
   * ==========================================
   * Recycle Vehicle
   * ==========================================
   *
   * Recycle در Traffic به معنی حذف و Spawn مجدد نیست.
   * همان Vehicle فعال مستقیماً به یک نقطه امن و خارج از دید دوربین
   * منتقل می‌شود و همان‌جا دوباره حرکت خود را ادامه می‌دهد.
   *
   * این ترتیب باعث می‌شود:
   * - activeVehicles هیچ‌وقت برای Recycle کم نشود.
   * - Vehicle هرگز برای Recycle مخفی نشود.
   * - Pool در چرخه عادی Traffic درگیر نشود.
   * - عمر خودرو وابسته به زمان نباشد؛ فقط پایان Road بدون اتصال باعث Recycle می‌شود.
   */
  private recycleVehicle(index: number): void {
    const active = this.activeVehicles[index];

    if (!active || !this.hasCameraPosition || this.roads.length === 0) {
      return;
    }

    // اگر قبلاً برای همین خودرو درخواست Recycle ثبت شده، دوباره اجرا نشود.
    if (this.pendingRecycleVehicles.has(active)) {
      return;
    }

    /**
     * بسیار مهم: تا وقتی خود خودرو در محدوده دید دوربین است،
     * آن را به نقطه دیگری Teleport نمی‌کنیم.
     *
     * حتی اگر مقصد جدید کاملاً Off-screen باشد، جابه‌جایی Transform
     * خودرو در حالی که مبدا روی صفحه دیده می‌شود، از دید کاربر
     * به شکل ناپدید شدن ناگهانی دیده می‌شود.
     */
    if (
      this.isPositionInsideCameraSafetyZone(
        active.vehicle.group.position,
      )
    ) {
      this.pendingRecycleVehicles.add(active);
      active.targetSpeed = 0;
      active.vehicle.setTargetSpeed(0);
      return;
    }

    const candidate =
      this.findOffscreenRecycleCandidate(
        this.lastCameraPosition,
        active,
      );

    // اگر مقصد امن پیدا نشد، ماشین را حذف/مخفی نمی‌کنیم.
    // تلاش بعدی در Frameهای بعد انجام می‌شود.
    if (!candidate) {
      this.pendingRecycleVehicles.add(active);
      return;
    }

    this.applyRecycleCandidate(active, candidate);
  }

  /**
   * ==========================================
   * Find Offscreen Recycle Candidate
   * ==========================================
   *
   * تمام Roadهای فعال و هر دو Lane بررسی می‌شوند؛ دیگر برای Recycle
   * یک Road تصادفی انتخاب نمی‌کنیم. مقصد باید از دوربین دور باشد و
   * با Traffic موجود تداخل نداشته باشد.
   */
  private findOffscreenRecycleCandidate(
    cameraPosition: THREE.Vector3,
    ignoredVehicle?: ActiveVehicleData,
  ): {
    road: Road;
    laneIndex: number;
    direction: VehicleDirection;
    distance: number;
    cameraDistance: number;
  } | null {
    const candidates: {
      road: Road;
      laneIndex: number;
      direction: VehicleDirection;
      distance: number;
      cameraDistance: number;
    }[] = [];

    for (const road of this.roads) {
      const min =
        road.getLongitudinalMin() +
        CarManager.TRANSITION_EXIT_DISTANCE;
      const max =
        road.getLongitudinalMax() -
        CarManager.TRANSITION_EXIT_DISTANCE;

      /**
       * فقط به دو سر Road وابسته نیستیم؛ چند نقطه در طول Road بررسی می‌شود.
       * این کار مخصوصاً بعد از Chunk شدن شهر، احتمال نبودن Spawn معتبر را کم می‌کند.
       */
      for (
        let sampleIndex = 0;
        sampleIndex < CarManager.SPAWN_POSITION_SAMPLES;
        sampleIndex++
      ) {
        const t =
          CarManager.SPAWN_POSITION_SAMPLES === 1
            ? 0.5
            : sampleIndex /
              (CarManager.SPAWN_POSITION_SAMPLES - 1);

        const distance =
          THREE.MathUtils.lerp(min, max, t);

        for (
          let laneIndex = 0;
          laneIndex < Road.LANE_COUNT;
          laneIndex++
        ) {
          const direction =
            this.getDirectionForRoad(
              road,
              laneIndex,
            );

          const position =
            this.getVehicleWorldPosition(
              road,
              laneIndex,
              distance,
            );

          const cameraDistance =
            position.distanceTo(cameraPosition);

          /**
           * فاصله به‌تنهایی کافی نیست. یک نقطه می‌تواند 42 واحد از دوربین
           * دور باشد ولی هنوز داخل تصویر دیده شود. چنین نقطه‌ای برای Recycle
           * ممنوع است، چون انتقال خودرو به آن باعث چشمک/Teleport قابل مشاهده می‌شود.
           */
          if (
            cameraDistance <
            CarManager.SPAWN_MIN_CAMERA_DISTANCE
          ) {
            continue;
          }

          if (this.isPositionInsideCameraSafetyZone(position)) {
            continue;
          }

          if (
            !this.canSpawnCar(
              road,
              laneIndex,
              direction,
              distance,
              ignoredVehicle,
            )
          ) {
            continue;
          }

          candidates.push({
            road,
            laneIndex,
            direction,
            distance,
            cameraDistance,
          });
        }
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    /**
     * ابتدا مقصدهایی را ترجیح می‌دهیم که داخل بازه ترجیحی 42 تا 72 واحد باشند.
     * اگر چنین مقصدی نبود، دورترین مقصد معتبر را انتخاب می‌کنیم.
     */
    const preferred = candidates.filter(
      (candidate) =>
        candidate.cameraDistance <=
        CarManager.SPAWN_MAX_CAMERA_DISTANCE,
    );

    const pool =
      preferred.length > 0
        ? preferred
        : candidates;

    pool.sort(
      (a, b) =>
        b.cameraDistance - a.cameraDistance,
    );

    const topCount = Math.min(
      6,
      pool.length,
    );

    return (
      pool[
        Math.floor(Math.random() * topCount)
      ] ?? null
    );
  }

  /**
   * ==========================================
   * Camera Safety Check
   * ==========================================
   *
   * بررسی می‌کند که نقطه مقصد داخل Frustum دوربین یا خیلی نزدیک به لبه
   * تصویر نباشد. حاشیه اضافه عمداً کمی بزرگ‌تر از خود تصویر است تا اگر
   * خودرو دقیقاً روی لبه صفحه قرار گرفت، Teleport آن دیده نشود.
   */
  private isPositionInsideCameraSafetyZone(
    position: THREE.Vector3,
  ): boolean {
    if (!this.camera) {
      // اگر Camera هنوز ثبت نشده، حداقل بررسی فاصله انجام شده است.
      return false;
    }

    this.tempProjectedPosition
      .copy(position)
      .project(this.camera);

    const ndc = this.tempProjectedPosition;

    // NDC z خارج از این بازه یعنی نقطه پشت/خارج از عمق قابل نمایش دوربین است.
    if (ndc.z < -1 || ndc.z > 1) {
      return false;
    }

    // حاشیه ایمنی بیشتر از 1 باعث می‌شود نقطه حتی نزدیک لبه تصویر هم نباشد.
    const safetyMargin = 1.18;

    return (
      Math.abs(ndc.x) <= safetyMargin &&
      Math.abs(ndc.y) <= safetyMargin
    );
  }

  /**
   * ==========================================
   * Apply Recycle Candidate
   * ==========================================
   *
   * همان Vehicle فعال را در مقصد جدید قرار می‌دهد؛ هیچ visible=false،
   * release یا pop از Pool در این مسیر وجود ندارد.
   */
  private applyRecycleCandidate(
    active: ActiveVehicleData,
    candidate: {
      road: Road;
      laneIndex: number;
      direction: VehicleDirection;
      distance: number;
    },
  ): void {
    const position =
      this.getVehicleWorldPosition(
        candidate.road,
        candidate.laneIndex,
        candidate.distance,
      );

    active.road = candidate.road;
    active.laneIndex = candidate.laneIndex;
    active.roadDistance = candidate.distance;
    active.trafficTransition = null;
    active.intersectionWaitTime = 0;
    active.waitingAtIntersection = false;

    /**
     * در Recycle از activate() استفاده نمی‌کنیم.
     *
     * activate() بخشی از lifecycle اولیه Vehicle است؛ فراخوانی دوباره آن روی
     * یک Vehicle فعال می‌تواند باعث Reset داخلی مدل، تغییر وضعیت نمایش یا
     * پرش یک‌فریمی شود. برای Traffic بی‌نهایت فقط Transform و وضعیت حرکت را
     * منتقل می‌کنیم.
     */
    active.vehicle.group.position.copy(position);
    active.vehicle.group.position.y =
      CarManager.VEHICLE_Y;

    active.vehicle.setDirection(
      candidate.direction,
    );

    /**
     * Recycle فقط مکان و مسیر را عوض می‌کند.
     * سرعت طبیعی خودرو حفظ می‌شود تا بعد از Recycle شتاب ناگهانی نگیرد.
     */
    active.targetSpeed = active.cruiseSpeed;

    active.vehicle.setTargetSpeed(
      active.motionSpeed,
    );

    // Visibility اینجا اصلاً تغییر نمی‌کند؛ Vehicle از ابتدا Active و visible است.
    this.pendingRecycleVehicles.delete(active);
  }

  /**
   * ==========================================
   * Process Pending Recycles
   * ==========================================
   *
   * فقط زمانی اجرا می‌شود که در تلاش قبلی مقصد امن پیدا نشده باشد.
   * ماشین در این مدت از active list خارج نمی‌شود و Pool نیز دست‌کاری نمی‌شود.
   */
  private processPendingRecycles(): void {
    if (
      this.roads.length === 0 ||
      !this.hasCameraPosition ||
      this.pendingRecycleVehicles.size === 0
    ) {
      return;
    }

    const pending = Array.from(
      this.pendingRecycleVehicles,
    );

    for (const active of pending) {
      if (!this.activeVehicles.includes(active)) {
        this.pendingRecycleVehicles.delete(active);
        continue;
      }

      /**
       * اگر خود خودرو هنوز روی صفحه است، Recycle را عقب می‌اندازیم.
       * در این حالت updateTrafficState سرعت آن را به صفر نرم می‌کند
       * تا از انتهای Road عبور نکند و ناگهان ناپدید نشود.
       */
      if (
        this.isPositionInsideCameraSafetyZone(
          active.vehicle.group.position,
        )
      ) {
        active.targetSpeed = 0;
        active.vehicle.setTargetSpeed(0);
        continue;
      }

      const candidate =
        this.findOffscreenRecycleCandidate(
          this.lastCameraPosition,
          active,
        );

      if (!candidate) {
        continue;
      }

      this.applyRecycleCandidate(
        active,
        candidate,
      );
    }
  }

  /**
   * ==========================================
   * Release Vehicle
   * ==========================================
   */

  private releaseVehicle(
    index: number,
  ): void {
    const active =
      this.activeVehicles[index];

    if (!active) {
      return;
    }

    this.pendingRecycleVehicles.delete(active);

    active.vehicle.reset();

    active.vehicle.group.visible =
      false;

    this.availableVehicles.push(
      active.vehicle,
    );

    this.activeVehicles.splice(
      index,
      1,
    );
  }

  /**
   * ==========================================
   * Stats
   * ==========================================
   */

  public getStats(): {
    active: number;
    pooled: number;
    maxActive: number;
    ready: boolean;
  } {
    return {
      active:
        this.activeVehicles.length,

      pooled:
        this.availableVehicles.length,

      maxActive:
        CarManager.POOL_SIZE,

      ready: this.initialized,
    };
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */

  public dispose(): void {
    for (const active of this.activeVehicles) {
      active.vehicle.dispose();
    }

    for (const vehicle of this.availableVehicles) {
      vehicle.dispose();
    }

    this.pendingRecycleVehicles.clear();

    this.activeVehicles.length = 0;

    this.availableVehicles.length = 0;

    this.roads.length = 0;

    this.initialCarsSpawned = false;

    this.initialized = false;

    this.initializing = false;

    this.refillTimer = 0;

    this.scene = null;
    this.camera = null;

    this.vehicleFactory.dispose();
  }
}