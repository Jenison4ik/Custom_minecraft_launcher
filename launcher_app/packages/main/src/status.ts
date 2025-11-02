/**
 * A simple class for storing a boolean status (e.g., whether a game is running).
 * Uses a private field `#status` that cannot be accessed outside the class.
 */
class Status {
  #status: boolean;

  constructor() {
    this.#status = false;
  }

  /**
   * Sets a new status value.
   * @param {boolean} bool The new status value
   */
  setStatus(bool: boolean): void {
    this.#status = bool;
  }

  /**
   * Returns the current status value.
   * @returns {boolean} The current status
   */
  getStatus(): boolean {
    return this.#status;
  }
}

/**
 * Export a single shared instance of Status.
 * All imports of this module will share the same state.
 */
export default new Status();
