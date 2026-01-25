/**
 * 对象状态 Store
 * 管理 SVG 对象的位置、缩放和选中状态
 */

import { createStore, produce } from 'solid-js/store';
import type { Vector3D } from '@/core/types';
import { INTERACTION_CONFIG } from '@/config';
import { syncSVGObjectPosition, syncAllSVGObjectsSelected } from '@/utils/three-sync';

export interface ObjectState {
  position: Vector3D;
  scale: number;
  rotation: Vector3D;
  selected: boolean;
}

export type ObjectStoreState = {
  selectedObjectId: string | null;
  objects: Record<string, ObjectState>;
  initialPositions: Record<string, Vector3D>;
};

const initialObjects: Record<string, ObjectState> = {
  v: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
  b: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
  o: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
  t: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
  flower: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
  bot: { position: { x: 0, y: 0, z: 0 }, scale: 1.0, rotation: { x: Math.PI / 12, y: -Math.PI / 6, z: 0 }, selected: false },
};

const initialState: ObjectStoreState = {
  selectedObjectId: null,
  objects: initialObjects,
  initialPositions: {},
};

export const [objectStore, setObjectStore] = createStore(initialState);

/**
 * Actions - 状态更新函数
 */
export const objectActions = {
  /**
   * 选择对象
   */
  selectObject(id: string | null) {
    // 取消之前选中的对象
    if (objectStore.selectedObjectId) {
      setObjectStore('objects', objectStore.selectedObjectId, 'selected', false);
    }

    if (id) {
      setObjectStore('objects', id, 'selected', true);
    }
    setObjectStore({ selectedObjectId: id });
  },

  /**
   * 更新对象位置
   */
  updateObjectPosition(id: string, position: Partial<Vector3D>) {
    setObjectStore('objects', id, 'position', produce((pos) => {
      if (position.x !== undefined) pos.x = position.x;
      if (position.y !== undefined) pos.y = position.y;
      if (position.z !== undefined) pos.z = position.z;
    }));
  },

  /**
   * 设置对象位置（直接设置）
   */
  setObjectPosition(id: string, position: Vector3D) {
    setObjectStore('objects', id, 'position', { ...position });
  },

  /**
   * 更新对象缩放
   */
  updateObjectScale(id: string, scale: number) {
    const clampedScale = Math.max(
      INTERACTION_CONFIG.SCALE_MIN,
      Math.min(INTERACTION_CONFIG.SCALE_MAX, scale)
    );
    setObjectStore('objects', id, 'scale', clampedScale);
  },

  /**
   * 更新对象旋转
   */
  updateObjectRotation(id: string, rotation: Vector3D) {
    setObjectStore('objects', id, 'rotation', { ...rotation });
  },

  /**
   * 更新所有对象旋转 (用于视差效果)
   */
  setAllObjectsRotation(rotation: Vector3D) {
    const ids = Object.keys(objectStore.objects);
    // 为每个对象单独更新旋转
    ids.forEach(id => {
      setObjectStore('objects', id, 'rotation', { ...rotation });
    });
  },

  /**
   * 重置所有对象到初始状态
   */
  resetAllObjects() {
    const resetState: Record<string, ObjectState> = {};
    const initialPositions = objectStore.initialPositions;

    Object.keys(initialObjects).forEach(id => {
      // 使用保存的初始位置，如果没有则使用默认 (0, 0, 0)
      const initialPos = initialPositions[id] || { x: 0, y: 0, z: 0 };
      resetState[id] = {
        position: { ...initialPos },
        scale: 1.0,
        rotation: { x: 0, y: 0, z: 0 },
        selected: false,
      };

      // 同步到 Three.js 场景
      syncSVGObjectPosition(id, initialPos);
    });

    // 取消所有选中高亮
    syncAllSVGObjectsSelected(false);

    setObjectStore({ selectedObjectId: null, objects: resetState });
  },

  /**
   * 设置多个对象的初始位置（用于初始化）
   */
  setInitialPositions(positions: Record<string, Vector3D>) {
    // 保存初始位置供 reset 使用
    setObjectStore('initialPositions', { ...positions });

    // 同时更新当前对象位置
    Object.entries(positions).forEach(([id, pos]) => {
      setObjectStore('objects', id, 'position', { ...pos });
    });
  },
};
