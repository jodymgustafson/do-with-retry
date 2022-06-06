import {
    AttemptCountExceededError,
    doWithRetry,
    DoWithRetryOptions, linearBackoff, overrideDefaultOptions
} from "..";

// Only use for debugging
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

overrideDefaultOptions({
    initTimeout: 1,
    getNextTimeout: linearBackoff(1)
});

describe("When succeed on the first attempt", () => {
    let attempts = 0;
    it("should complete successfully", async () => {
        const result = await doWithRetry((_retry, attempt) => {
            attempts = attempt + 1;
            return "completed";
        });

        expect(result).toBe("completed");
        expect(attempts).toBe(1);
    });
});

describe("When succeed after multiple attempts", () => {
    let attempts = 0;
    it("should complete successfully", async () => {
        const result = await doWithRetry((retry, attempt) => {
            attempts = attempt + 1;
            if (attempt !== 3) {
                retry();
            }
            return "completed";
        });

        expect(result).toBe("completed");
        expect(attempts).toBe(4);
    });
});

describe("When fail after multiple attempts", () => {
    it("should throw an error", async () => {
        let attempts = 0;
        try {
            const options: DoWithRetryOptions = { maxAttempts: 5 };
            await doWithRetry((retry, attempt) => {
                attempts = attempt + 1;
                retry(new Error("Failed on attempt " + attempt));
                return "completed";
            }, options);

            throw new Error("Should have thrown an error");
        }
        catch (err) {
            expect(err).toBeInstanceOf(AttemptCountExceededError);
            if (err instanceof AttemptCountExceededError) {
                expect(err.message).toBe("Maximum attempt count exceeded");
                expect((err.cause as Error).message).toBe("Failed on attempt 4");
            }
        }

        expect(attempts).toBe(5);
    });
});

describe("When fails then succeeds", () => {
    it("callbacks should be called", async () => {
        let attempts = 0;
        let failMsg = "";
        let success = "";
        const options: DoWithRetryOptions<string> = {
            onFail: (error) => { if (error) failMsg = (error as Error).message },
            onSuccess: result => success = result
        };
        const result = await doWithRetry((retry, attempt) => {
            attempts = attempt + 1;
            if (attempt === 0) {
                retry();
            }
            return "completed";
        }, options);

        expect(result).toBe("completed");
        expect(attempts).toBe(2);
        expect(failMsg).toBe("");
        expect(success).toBe("completed");
    });
});

describe("When throws an uncaught error", () => {
    it("should rethrow the error", async () => {
        let attempts = 0;
        try {
            await doWithRetry((_retry, attempt) => {
                attempts = attempt + 1;
                throw new Error("Test Error");
            });

            throw new Error("Should have thrown an error");
        }
        catch (err) {
            expect((err as Error).message).toBe("Test Error");
        }

        expect(attempts).toBe(1);
    });
});

describe("When call async function and retry", () => {
    let attempts = 0;
    let failMsg = "";
    it("should complete successfully", async () => {
        const options: DoWithRetryOptions = {
            onFail: (error) => { if (error) failMsg = (error as Error).message },
        };
        const result = await doWithRetry<Promise<string>>(async (retry, attempt) => {
            attempts = attempt + 1;
            return await errorTest(attempt).catch(retry);
        }, options);

        expect(result).toBe("completed");
        expect(attempts).toBe(4);
        expect(failMsg).toBe("Base Error");
    });

    async function errorTest(attempt: number): Promise<string> {
        if (attempt !== 3) {
            throw new Error("Base Error");
        }
        return "completed";
    }
});
