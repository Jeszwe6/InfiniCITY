import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import {
  Vehicle,
  type VehicleModelType,
} from "./Vehicle";

/**
 * ==========================================
 * VehicleFactory
 * ==========================================
 *
 * مسئول:
 *
 * - Load کردن مدل‌های GLB
 * - نگهداری Cache مدل‌ها
 * - ساخت Vehicle جدید از روی مدل Cache شده
 * - ساخت Pool خودروها
 * - مدیریت Loading
 *
 * نکته:
 * مدل اصلی هیچ‌وقت مستقیماً به Vehicle داده نمی‌شود.
 * برای هر Vehicle یک Clone مستقل ساخته می‌شود.
 */
export class VehicleFactory {
  /**
   * ==========================================
   * Model Paths
   * ==========================================
   */

  private static readonly VEHICLE_MODELS: Record<
    VehicleModelType,
    string
  > = {
    taxi:
      "/assets/vehicles/Models/GLB%20format/taxi.glb",

    sedan:
      "/assets/vehicles/Models/GLB%20format/sedan.glb",

    "sedan-sports":
      "/assets/vehicles/Models/GLB%20format/sedan-sports.glb",

    "hatchback-sports":
      "/assets/vehicles/Models/GLB%20format/hatchback-sports.glb",

    suv:
      "/assets/vehicles/Models/GLB%20format/suv.glb",

    "suv-luxury":
      "/assets/vehicles/Models/GLB%20format/suv-luxury.glb",

    van:
      "/assets/vehicles/Models/GLB%20format/van.glb",

    delivery:
      "/assets/vehicles/Models/GLB%20format/delivery.glb",

    truck:
      "/assets/vehicles/Models/GLB%20format/truck.glb",

    "truck-flat":
      "/assets/vehicles/Models/GLB%20format/truck-flat.glb",

    police:
      "/assets/vehicles/Models/GLB%20format/police.glb",

    ambulance:
      "/assets/vehicles/Models/GLB%20format/ambulance.glb",

    firetruck:
      "/assets/vehicles/Models/GLB%20format/firetruck.glb",

    "garbage-truck":
      "/assets/vehicles/Models/GLB%20format/garbage-truck.glb",

    race:
      "/assets/vehicles/Models/GLB%20format/race.glb",

    "race-future":
      "/assets/vehicles/Models/GLB%20format/race-future.glb",

    tractor:
      "/assets/vehicles/Models/GLB%20format/tractor.glb",
  };

  /**
   * ==========================================
   * Internal State
   * ==========================================
   */

  private readonly loader: GLTFLoader;

  private readonly models =
    new Map<
      VehicleModelType,
      THREE.Group
    >();

  private readonly loading =
    new Map<
      VehicleModelType,
      Promise<THREE.Group>
    >();

  /**
   * ==========================================
   * Constructor
   * ==========================================
   */

  constructor() {
    this.loader = new GLTFLoader();
  }

  /**
   * ==========================================
   * Get All Model Types
   * ==========================================
   */

  public getAllModelTypes(): VehicleModelType[] {
    return Object.keys(
      VehicleFactory.VEHICLE_MODELS,
    ) as VehicleModelType[];
  }

  /**
   * ==========================================
   * Get Model Path
   * ==========================================
   */

  public getModelPath(
    type: VehicleModelType,
  ): string {
    return VehicleFactory.VEHICLE_MODELS[type];
  }

  /**
   * ==========================================
   * Is Loaded
   * ==========================================
   */

  public isLoaded(
    type: VehicleModelType,
  ): boolean {
    return this.models.has(type);
  }

  /**
   * ==========================================
   * Is Loading
   * ==========================================
   */

  public isLoading(
    type: VehicleModelType,
  ): boolean {
    return this.loading.has(type);
  }

  /**
   * ==========================================
   * Load Model
   * ==========================================
   */

  private loadModel(
    type: VehicleModelType,
  ): Promise<THREE.Group> {
    const cached =
      this.models.get(type);

    if (cached) {
      return Promise.resolve(cached);
    }

    const currentLoading =
      this.loading.get(type);

    if (currentLoading) {
      return currentLoading;
    }

    const path =
      this.getModelPath(type);

    const promise =
      new Promise<THREE.Group>(
        (
          resolve,
          reject,
        ) => {
          this.loader.load(
            path,

            (gltf) => {
              const model =
                gltf.scene;

              model.traverse(
                (object) => {
                  const mesh =
                    object as THREE.Mesh;

                  if (
                    mesh.isMesh
                  ) {
                    mesh.castShadow =
                      false;

                    mesh.receiveShadow =
                      false;

                    if (
                      mesh.material
                    ) {
                      const material =
                        mesh.material as
                          | THREE.Material
                          | THREE.Material[];

                      if (
                        Array.isArray(
                          material,
                        )
                      ) {
                        for (
                          const item of
                            material
                        ) {
                          item.needsUpdate =
                            true;
                        }
                      } else {
                        material.needsUpdate =
                          true;
                      }
                    }
                  }
                },
              );

              this.models.set(
                type,
                model,
              );

              this.loading.delete(
                type,
              );

              resolve(model);
            },

            undefined,

            (error) => {
              this.loading.delete(
                type,
              );

              reject(error);
            },
          );
        },
      );

    this.loading.set(
      type,
      promise,
    );

    return promise;
  }

  /**
   * ==========================================
   * Preload
   * ==========================================
   */

  public async preload(
    type: VehicleModelType,
  ): Promise<void> {
    await this.loadModel(type);
  }

  /**
   * ==========================================
   * Preload All
   * ==========================================
   */

  public async preloadAll(): Promise<void> {
    const types =
      this.getAllModelTypes();

    await Promise.all(
      types.map(
        (type) =>
          this.preload(type),
      ),
    );
  }

  /**
   * ==========================================
   * Create Vehicle
   * ==========================================
   */

  public async createVehicle(
    type: VehicleModelType,
  ): Promise<Vehicle> {
    const originalModel =
      await this.loadModel(type);

    const clonedModel =
      cloneSkeleton(
        originalModel,
      );

    const vehicleGroup =
      new THREE.Group();

    vehicleGroup.add(
      clonedModel,
    );

    const vehicle =
      new Vehicle(
        vehicleGroup,
        type,
      );

    vehicle.reset();

    return vehicle;
  }

  /**
   * ==========================================
   * Create Vehicles
   * ==========================================
   */

  public async createVehicles(
    type: VehicleModelType,
    count: number,
  ): Promise<Vehicle[]> {
    if (count <= 0) {
      return [];
    }

    await this.preload(type);

    const vehicles: Vehicle[] = [];

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const vehicle =
        await this.createVehicle(
          type,
        );

      vehicles.push(
        vehicle,
      );
    }

    return vehicles;
  }

  /**
   * ==========================================
   * Dispose
   * ==========================================
   */

  public dispose(): void {
    for (
      const model of
        this.models.values()
    ) {
      model.traverse(
        (object) => {
          const mesh =
            object as THREE.Mesh;

          if (!mesh.isMesh) {
            return;
          }

          mesh.geometry.dispose();

          const material =
            mesh.material;

          if (
            Array.isArray(
              material,
            )
          ) {
            for (
              const item of
                material
            ) {
              item.dispose();
            }
          } else {
            material.dispose();
          }
        },
      );
    }

    this.models.clear();
    this.loading.clear();
  }
}

export default VehicleFactory;