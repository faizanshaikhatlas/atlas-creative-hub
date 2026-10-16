/**
 * Undo/redo history for the canvas.
 *
 * Strategy: snapshot the whole canvas as a JSON string on each committed
 * change. This is simple, robust, and serialization already exists because we
 * persist the same JSON to IndexedDB. For a thumbnail editor the documents are
 * small, so full snapshots are cheap and avoid the fragility of command diffs.
 *
 * The manager is intentionally framework-agnostic: it knows nothing about React
 * or Fabric. The CanvasController feeds it snapshots and asks it to apply them.
 */

const DEFAULT_LIMIT = 60;

export class HistoryManager {
  constructor({ limit = DEFAULT_LIMIT, onChange } = {}) {
    this.limit = limit;
    this.onChange = onChange || (() => {});
    this.stack = [];
    this.index = -1;
    // When true, incoming snapshots are ignored (we are applying history or
    // loading a document and must not record those as user actions).
    this.locked = false;
  }

  /** Seed the initial state (e.g. after a project loads). Clears any history. */
  reset(snapshot) {
    this.stack = snapshot != null ? [snapshot] : [];
    this.index = this.stack.length - 1;
    this.notify();
  }

  /** Record a new committed state, dropping any redo branch. */
  record(snapshot) {
    if (this.locked) return;
    if (snapshot == null) return;
    // Skip no-op snapshots identical to the current state.
    if (this.stack[this.index] === snapshot) return;

    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(snapshot);

    // Enforce the cap by dropping the oldest entries.
    if (this.stack.length > this.limit) {
      const overflow = this.stack.length - this.limit;
      this.stack.splice(0, overflow);
    }
    this.index = this.stack.length - 1;
    this.notify();
  }

  canUndo() {
    return this.index > 0;
  }

  canRedo() {
    return this.index < this.stack.length - 1;
  }

  /** Returns the snapshot to apply, or null if not possible. */
  undo() {
    if (!this.canUndo()) return null;
    this.index -= 1;
    this.notify();
    return this.stack[this.index];
  }

  redo() {
    if (!this.canRedo()) return null;
    this.index += 1;
    this.notify();
    return this.stack[this.index];
  }

  notify() {
    this.onChange({ canUndo: this.canUndo(), canRedo: this.canRedo() });
  }
}
