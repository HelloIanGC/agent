import { TIMEOUTS, ERROR_MESSAGES } from '../constants';

/**
 * 统一的Promise工具类 - 解决重复的cleanup逻辑问题
 */
export class PromiseUtils {

  /**
   * 创建一个带超时和清理的Promise
   */
  static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutError = new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`);

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(timeoutError), timeoutMs);
      // Store timer for potential cleanup
      (timeoutPromise as any)._timer = timer;
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      // Cleanup timeout
      if ((timeoutPromise as any)._timer) {
        clearTimeout((timeoutPromise as any)._timer);
      }
    });
  }

  /**
   * 创建一个WebSocket操作Promise，带自动清理
   */
  static createWebSocketOperation<T>(
    operationId: string,
    sendMessage: (id: string) => void,
    timeoutMs: number = TIMEOUTS.OPERATION_TIMEOUT,
    timeoutMessage?: string
  ): {
    promise: Promise<T>;
    cleanup: () => void;
    addClient: (client: any, responseHandler: (message: string) => void) => void;
  } {
    let cleanup: () => void = () => {};
    const pendingClients = new Set<any>();

    const promise = new Promise<T>((resolve, reject) => {
      // Setup timeout with cleanup
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(timeoutMessage || `${ERROR_MESSAGES.OPERATION_TIMEOUT} after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store cleanup function
      cleanup = () => {
        clearTimeout(timeout);
        // Clean up all listeners
        pendingClients.forEach(client => {
          if (client.readyState === 1 && client.removeListener) {
            // This will be set by addClient
            const handler = (client as any)._currentHandler;
            if (handler) {
              client.removeListener('message', handler);
            }
          }
        });
        pendingClients.clear();
      };

      // Send the message
      try {
        sendMessage(operationId);
      } catch (error) {
        cleanup();
        reject(error);
      }

      // Store resolve/reject for external use
      (promise as any)._resolve = resolve;
      (promise as any)._reject = reject;
    });

    const addClient = (client: any, responseHandler: (message: string) => void) => {
      if (client.readyState === 1) {
        client.addListener('message', responseHandler);
        // Store handler for cleanup
        (client as any)._currentHandler = responseHandler;
        pendingClients.add(client);
      }
    };

    return {
      promise,
      cleanup,
      addClient
    };
  }

  /**
   * 重试Promise操作
   */
  static retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      let lastError: Error;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await operation();
          resolve(result);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt === maxAttempts) {
            reject(new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`));
            return;
          }

          // Wait before retry
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
    });
  }

  /**
   * 创建一个可取消的Promise
   */
  static cancellable<T>(
    promise: Promise<T>
  ): {
    promise: Promise<T>;
    cancel: () => void;
    isCancelled: () => boolean;
  } {
    let isCancelled = false;
    let cancelCallback: (() => void) | undefined;

    const cancellablePromise = new Promise<T>((resolve, reject) => {
      promise
        .then(result => {
          if (!isCancelled) {
            resolve(result);
          }
        })
        .catch(error => {
          if (!isCancelled) {
            reject(error);
          }
        });

      cancelCallback = () => {
        isCancelled = true;
        reject(new Error('Operation was cancelled'));
      };
    });

    return {
      promise: cancellablePromise,
      cancel: () => {
        if (cancelCallback) {
          cancelCallback();
        }
      },
      isCancelled: () => isCancelled
    };
  }

  /**
   * Promise.all 的安全版本，部分失败不影响其他
   */
  static allSettled<T>(promises: Promise<T>[]): Promise<Array<{
    status: 'fulfilled' | 'rejected';
    value?: T;
    reason?: any;
  }>> {
    return Promise.all(
      promises.map(promise =>
        promise
          .then(value => ({ status: 'fulfilled' as const, value }))
          .catch(reason => ({ status: 'rejected' as const, reason }))
      )
    );
  }
}