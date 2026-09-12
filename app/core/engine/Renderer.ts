import * as THREE from 'three'

/**
 * Renderer
 *
 * مسئول ساخت WebGLRenderer و نمایش صحنه Three.js است.
 *
 * فعلاً تنظیمات پایه را می‌گذاریم.
 * تنظیمات پیشرفته‌تر مثل Shadow Map و Color Management
 * را در مراحل بعد اضافه می‌کنیم.
 */
export class Renderer {
  public readonly instance: THREE.WebGLRenderer

  constructor() {
    // ساخت Renderer اصلی Three.js
    this.instance = new THREE.WebGLRenderer({
      antialias: true,
    })

    // فعال کردن شفافیت Canvas
    this.instance.setClearColor(0x000000, 1)

    // تنظیم اندازه اولیه Renderer
    this.resize(window.innerWidth, window.innerHeight)
  }

  /**
   * تغییر اندازه Renderer
   */
  public resize(width: number, height: number): void {
    this.instance.setSize(width, height, false)
  }

  /**
   * رندر کردن Scene با Camera
   */
  public render(
    scene: THREE.Scene,
    camera: THREE.Camera
  ): void {
    this.instance.render(scene, camera)
  }
}