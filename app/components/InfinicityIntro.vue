<script setup lang="ts">
/**
 * ==========================================
 * InfiniCITY Intro
 * ==========================================
 *
 * نسخه تستی Static.
 *
 * فعلاً هیچ:
 * - Animation
 * - Transition
 * - Timer
 * - onMounted
 *
 * نداریم.
 *
 * هدف این مرحله فقط این است که مطمئن شویم
 * خود کامپوننت روی صفحه Render می‌شود.
 */
</script>

<template>
  <!-- ========================================
       Intro
       ======================================== -->

  <div class="intro">

    <div class="intro-content">

      <!-- نام پروژه -->
      <div class="title">
        INFINICITY
      </div>

      <!-- سازنده -->
      <div class="subtitle">
        MADE BY CODINCI
      </div>

    </div>

  </div>

  <!-- ========================================
       نام دائمی پروژه
       ======================================== -->

  <div class="site-title">
    INFINICITY
  </div>
</template>

<style scoped>
/* ==========================================
   Intro
   ========================================== */

.intro {
  position: fixed;

  inset: 0;

  /*
   * باید بالاتر از Canvas Three.js باشد.
   */
  z-index: 999999;

  display: flex;

  align-items: center;
  justify-content: center;

  background: #08090b;

  pointer-events: none;
}


/* ==========================================
   محتوا
   ========================================== */

.intro-content {
  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;
}


/* ==========================================
   عنوان
   ========================================== */

.title {
  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size:
    clamp(40px, 7vw, 80px);

  font-weight: 700;

  letter-spacing: 0.18em;

  color: #ffffff;

  white-space: nowrap;
}


/* ==========================================
   زیرعنوان
   ========================================== */

.subtitle {
  margin-top: 14px;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 12px;

  letter-spacing: 0.28em;

  color:
    rgba(255, 255, 255, 0.5);

  white-space: nowrap;
}


/* ==========================================
   نام دائمی
   ========================================== */

.site-title {
  position: fixed;

  top: 22px;
  left: 24px;

  z-index: 1000000;

  font-family:
    Arial,
    Helvetica,
    sans-serif;

  font-size: 11px;

  font-weight: 600;

  letter-spacing: 0.18em;

  color: #ffffff;

  pointer-events: none;

  user-select: none;
}


/* ==========================================
   موبایل
   ========================================== */

@media (max-width: 600px) {
  .title {
    font-size: 38px;

    letter-spacing: 0.12em;
  }

  .subtitle {
    font-size: 9px;

    letter-spacing: 0.2em;
  }

  .site-title {
    top: 16px;
    left: 16px;

    font-size: 10px;
  }
}
</style>