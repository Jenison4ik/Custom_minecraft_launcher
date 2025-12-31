import { Task } from "@xmcl/task";

/**
 * Error types for Minecraft installation
 */

/**
 * Error with file path information (e.g., ChecksumNotMatchError)
 */
export interface FileError extends Error {
  file?: string;
  algorithm?: string;
}

/**
 * Network timeout error from undici
 */
export interface NetworkTimeoutError extends Error {
  code: "UND_ERR_CONNECT_TIMEOUT";
}

/**
 * Checksum mismatch error
 */
export interface ChecksumNotMatchError extends Error {
  name: "ChecksumNotMatchError";
  algorithm?: string;
  file?: string;
}

/**
 * Error with message property
 */
export interface ErrorWithMessage extends Error {
  message: string;
}

/**
 * Type guard to check if error has message property
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as ErrorWithMessage).message === "string"
  );
}

/**
 * Type guard to check if error is FileError
 */
export function isFileError(error: unknown): error is FileError {
  return (
    typeof error === "object" &&
    error !== null &&
    "file" in error &&
    typeof (error as FileError).file === "string"
  );
}

/**
 * Type guard to check if error is NetworkTimeoutError
 */
export function isNetworkTimeoutError(
  error: unknown
): error is NetworkTimeoutError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NetworkTimeoutError).code === "UND_ERR_CONNECT_TIMEOUT"
  );
}

/**
 * Type guard to check if error is ChecksumNotMatchError
 */
export function isChecksumNotMatchError(
  error: unknown
): error is ChecksumNotMatchError {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as ChecksumNotMatchError).name === "ChecksumNotMatchError"
  );
}

/**
 * Union type for all possible installation errors
 */
export type InstallationError =
  | FileError
  | NetworkTimeoutError
  | ChecksumNotMatchError
  | Error;

/**
 * Task callback types
 */

/**
 * Callback for task updates
 */
export type TaskUpdateCallback<T = unknown> = (task: Task<T>) => void;

/**
 * Callback for task failures
 */
export type TaskFailedCallback<T = unknown> = (
  task: Task<T>,
  error: InstallationError
) => void;

/**
 * Options for task execution
 */
export interface TaskExecutionOptions<T = unknown> {
  onUpdate?: TaskUpdateCallback<T>;
  onFailed?: TaskFailedCallback<T>;
}

/**
 * Agent configuration type for undici
 */
export interface AgentConfig {
  connections: number;
  pipelining: number;
  connectTimeout: number;
  requestTimeout?: number;
}
