/**
 * Given the current timeout and attempt number, returns the next timeout
 * @param curTimeout The current timeout
 * @param attempt Attempt number, on the first retry this will be 1
 */
export type BackoffFunction = (curTimeout: number, attempt: number) => number;

export type DoWithRetryOptions<T=any> = {
    /** Max number of times to attempt calling the function, default is 10 */
    maxAttempts?: number;
    /** Initial number of ms to wait until retry, default is 1000 */
    initTimeout?: number;
    /** Function that gets the next time to wait in ms, default is exponential */
    getNextTimeout?: BackoffFunction; 
    /** Function to be called when an attempt fails */
    onFail?: (error: Error | undefined, attempt: number) => any;
    /** Function to be called when the function succeeds */
    onSuccess?: (result: T, attempt: number) => any;
};

let DFLT_OPTIONS = {
    maxAttempts: 10,
    initTimeout: 1000,
    getNextTimeout: exponentialBackoff()
} as DoWithRetryOptions;

/**
 * Changes the global default options
 * @param options New default options with maxAttempts, initTimeout and getNextTimeout defined
 */
export function overrideDefaultOptions(options: DoWithRetryOptions): DoWithRetryOptions {
    return Object.assign(DFLT_OPTIONS, options);
}

/** Error message when an attempt failed */
export const ATTEMPT_FAILED_ERROR = "EATTEMPTFAILED";
/** Error message when attempt amount exceeded */
export const ATTEMPT_COUNT_EXCEEDED_ERROR = "EATTEMPTCOUNTEXCEEDED";

class RetryError extends Error {
    constructor(message: string, readonly wrappedError?: unknown) {
        super(message);
    }
}

type RetryFunction = (error?: unknown) => void;

const retry: RetryFunction = (error?: unknown) => {
    throw new RetryError(ATTEMPT_FAILED_ERROR, error);
}

/**
 * Executes a function any number of times until it completes successfully or a max number of attempts have been made
 * @param fn The function to execute
 * @param options Optional execution options
 * @returns The result of the function call
 * @throws Error if max attempts have been reached
 */
export async function doWithRetry<T>(fn: (retry: RetryFunction, attempt: number) => T, options?: DoWithRetryOptions<T>): Promise<T> {
    let timeout = options?.initTimeout ?? DFLT_OPTIONS.initTimeout!;
    const maxAttempts = options?.maxAttempts ?? DFLT_OPTIONS.maxAttempts!;
    const getNextTimeout = options?.getNextTimeout ?? DFLT_OPTIONS.getNextTimeout!;

    let attempt = 0;
    do {
        try {
            const result = await fn(retry, attempt);
            if (options?.onSuccess) {
                options.onSuccess(result, attempt);
            }
            return result;
        }
        catch (err) {
            if (err instanceof RetryError) {
                if (options?.onFail) {
                    options.onFail(err.wrappedError as Error, attempt);
                }
                
                if (++attempt < maxAttempts) {
                    timeout = getNextTimeout(timeout, attempt);
                    console.log("Waiting", timeout);
                    await sleep(timeout);
                }
                else break;
            }
            else {
                if (options?.onFail) {
                    options.onFail(err as Error, attempt);
                }
                // Unhandled error, rethrow
                throw err;
            }
        }
    }
    while (attempt < maxAttempts);

    // If we made it here the last attempt failed
    throw new Error(ATTEMPT_COUNT_EXCEEDED_ERROR);
}

/**
 * Waits for a period of time asyncronously
 * @example await sleep(100);
 * @param ms Number of milliseconds
 * @returns A promise to signal when done
 */
export async function sleep(ms: number): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/return-await
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


/** Timeout is the same on every retry */
export function constantBackoff(timeout?: number): BackoffFunction {
    return (curTimeout: number) => {
        return timeout ?? curTimeout;
    }
}

/**
 * Timeout increases linearly
 * @param increment The amount to increase on every retry (slope)
 * @param maxTimeout An optional max timeout
 */
export function linearBackoff(increment: number, maxTimeout = Number.MAX_SAFE_INTEGER): BackoffFunction {
    return (curTimeout: number, attempt: number) => {
        return attempt === 1 ? curTimeout : Math.min(curTimeout + increment, maxTimeout);
    }
}

/**
 * Timeout increases exponentially
 * @param exponent The exponent to use, default is 2
 * @param maxTimeout An optional max timeout
 */
export function exponentialBackoff(exponent = 2, maxTimeout = Number.MAX_SAFE_INTEGER): BackoffFunction {
    return (curTimeout: number, attempt: number) => {
        return attempt === 1 ? curTimeout : Math.min(curTimeout * exponent, maxTimeout);
    }
}

/**
 * Timeout increases logarithmically approaching the max timeout
 * @param maxTimeout The maximum timeout in ms
 * @param backoffRate The logarithm amount, default is base 2
 */
export function logarithmicBackoff(maxTimeout: number, backoffRate = 2): BackoffFunction {
    let factor = backoffRate;
    return () => {
        const timeout = maxTimeout - Math.floor(maxTimeout / factor);
        factor *= backoffRate;
        return timeout;
    }
}

/**
 * Timeout increases using the fibonacci sequence
 * @param factor An amount to multiply fibonacci number by to get timeout in ms, for seconds use 1000
 * @param maxTimeout An optional max timeout
 */
export function fibonacciBackoff(factor = 1000, maxTimeout = Number.MAX_SAFE_INTEGER): BackoffFunction {
    let fibPrev = 0;
    let fibCurr = 1;
    return () => {
        const temp = fibCurr;
        fibCurr = fibPrev + fibCurr;
        fibPrev = temp;
        return Math.min(factor * fibCurr, maxTimeout);
    }
}

/**
 * Timeout is random
 * @param minTimeout Minimum time to wait in ms
 * @param maxTimeout Maximum time to wait in ms
 */
export function randomBackoff(minTimeout: number, maxTimeout: number): BackoffFunction {
    if (maxTimeout <= minTimeout) {
        throw new Error("minTimeout must be less than maxTimeout");
    };
    return () => minTimeout + Math.floor(Math.random() * (maxTimeout - minTimeout));
}
