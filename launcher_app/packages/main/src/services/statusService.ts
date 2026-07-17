class StatusService {
  #status = false;

  setStatus(bool: boolean): void {
    this.#status = bool;
  }

  getStatus(): boolean {
    return this.#status;
  }
}

/** Shared singleton — all imports share the same state. */
const Status = new StatusService();
export default Status;
