class StatusService {
  #held = false;

  /** True when a file check or a launch is already in progress. */
  tryBegin(): boolean {
    if (this.#held) return false;
    this.#held = true;
    return true;
  }

  end(): void {
    this.#held = false;
  }

  getStatus(): boolean {
    return this.#held;
  }
}

/** Shared singleton — all imports share the same state. */
const Status = new StatusService();
export default Status;
