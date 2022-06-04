import {
    constantBackoff,
    exponentialBackoff,
    fibonacciBackoff,
    linearBackoff,
    upwardDecayBackoff,
    randomBackoff
} from "..";

describe("When use constant backoff", () => {
    it("should get the same timeout every time", () => {
        const backoff = constantBackoff(100);
        expect(backoff(0, 1)).withContext("first call").toBe(100);
        expect(backoff(100, 2)).withContext("second call").toBe(100);
        expect(backoff(100, 3)).withContext("third call").toBe(100);
    });
});

describe("When use linear backoff", () => {
    it("should get linear growth with slope of 10", () => {
        const backoff = linearBackoff(10);
        expect(backoff(100, 1)).withContext("first call").toBe(100);
        expect(backoff(100, 2)).withContext("second call").toBe(110);
        expect(backoff(110, 3)).withContext("third call").toBe(120);
    });
    it("should get linear growth with slope of 100 and max of 350", () => {
        const backoff = linearBackoff(100, 350);
        expect(backoff(100, 1)).withContext("first call").toBe(100);
        expect(backoff(100, 2)).withContext("second call").toBe(200);
        expect(backoff(200, 3)).withContext("third call").toBe(300);
        expect(backoff(300, 4)).withContext("fourth call").toBe(350);
    });
});

describe("When use exponential backoff", () => {
    it("should get exponential growth", () => {
        const backoff = exponentialBackoff();
        expect(backoff(100, 1)).withContext("first call").toBe(100);
        expect(backoff(100, 2)).withContext("second call").toBe(200);
        expect(backoff(200, 3)).withContext("third call").toBe(400);
    });
    it("should get exponential growth with exponent of 10 and limit of 12000", () => {
        const backoff = exponentialBackoff(10, 12000);
        expect(backoff(100, 1)).withContext("first call").toBe(100);
        expect(backoff(100, 2)).withContext("second call").toBe(1000);
        expect(backoff(1000, 3)).withContext("third call").toBe(10000);
        expect(backoff(10000, 4)).withContext("fourth call").toBe(12000);
        expect(backoff(12000, 5)).withContext("fifth call").toBe(12000);
    });
});

describe("When use upward decay backoff", () => {
    it("should get upward decay growth at rate of 2", () => {
        const backoff = upwardDecayBackoff(1000);
        expect(backoff(0, 1)).withContext("first call").toBe(500);
        expect(backoff(500, 2)).withContext("second call").toBe(750);
        expect(backoff(750, 3)).withContext("third call").toBe(875);
        expect(backoff(875, 4)).withContext("fourth call").toBe(938);
        expect(backoff(938, 5)).withContext("fifth call").toBe(969);
        expect(backoff(969, 6)).withContext("sixth call").toBe(984);
    });
    it("should get upward decay growth at rate of 10", () => {
        const backoff = upwardDecayBackoff(1000, 10);
        expect(backoff(0, 1)).withContext("first call").toBe(900);
        expect(backoff(900, 2)).withContext("second call").toBe(990);
        expect(backoff(990, 3)).withContext("third call").toBe(999);
        expect(backoff(999, 4)).withContext("fourth call").toBe(1000);
        expect(backoff(1000, 5)).withContext("fifth call").toBe(1000);
    });
});

describe("When use fibonacci backoff", () => {
    it("should get fibonacci growth", () => {
        const backoff = fibonacciBackoff();
        expect(backoff(0, 1)).withContext("first call").toBe(1000);
        expect(backoff(1000, 2)).withContext("second call").toBe(2000);
        expect(backoff(2000, 3)).withContext("third call").toBe(3000);
        expect(backoff(3000, 4)).withContext("fourth call").toBe(5000);
        expect(backoff(5000, 5)).withContext("fifth call").toBe(8000);
        expect(backoff(8000, 6)).withContext("sixth call").toBe(13000);
    });
    it("should get fibonacci growth with limit of 80", () => {
        const backoff = fibonacciBackoff(10, 80);
        expect(backoff(0, 1)).withContext("first call").toBe(10);
        expect(backoff(10, 2)).withContext("second call").toBe(20);
        expect(backoff(20, 3)).withContext("third call").toBe(30);
        expect(backoff(30, 4)).withContext("fourth call").toBe(50);
        expect(backoff(50, 5)).withContext("fifth call").toBe(80);
        expect(backoff(80, 6)).withContext("sixth call").toBe(80);
    });
});

describe("When use random backoff", () => {
    it("should get random timeout within range", () => {
        const backoff = randomBackoff(1000, 3000);
        let t = 0;
        for (let i = 1; i < 100; i++) {
            t = backoff(t, i);
            expect(t >= 1000 && t <= 3000).withContext("call " + i).toBeTrue();
        }
    });
    it("should get an error if min more than max", () => {
        expect(() => randomBackoff(3, 1)).toThrowError("minTimeout must be less than maxTimeout");
    });
});

describe("When use custom backoff", () => {
    it("should get custom timeout", () => {
        const backoff = (curTimeout: number, attempt: number) => {
            if (attempt === 1) return curTimeout;
            else return Math.floor(curTimeout * 1.5);
        };
        expect(backoff(10, 1)).withContext("first call").toBe(10);
        expect(backoff(10, 2)).withContext("second call").toBe(15);
        expect(backoff(15, 3)).withContext("third call").toBe(22);
        expect(backoff(22, 4)).withContext("fourth call").toBe(33);
    });
});
