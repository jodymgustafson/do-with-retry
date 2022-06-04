# DoWithRetry

This is an easy to use function to help execute code and retry after a certain amount of time if it fails.

In certain scenarios you may want to execute an operation and keep retrying if it fails. For example you may be calling a web service that could fail if you get a bad connection. In that case you'll want to retry, after a small delay, until either the call succeeds or fails enough times that you determine it's pointless to continue.

## Features

- Promise based, works with async code
- Failure is signaled by simply calling the retry() function that is passed into your user function
- Comes with a set of built in backoff functions, or create your own
- Built in TypeScript type definitions

## Install

`npm i do-with-retry`

## Quick Example

In the simplest example you call `doWithRetry` passing in a function to execute your code.

```javascript
const result = await doWithRetry(retry => {
    try {
        return doSomethingThatCouldThrow();
    }
    catch (error) {
        // If at first you don't succeed, try again
        retry();
    }
})
.catch(err => {
    console.error("All attempts to do something failed");
});
```

Your function takes one parameter, which is a function to call when you want `doWithRetry` to try again after waiting a certain amount of time.

When using the default options it will attempt to execute your function a maximum of 10 times and the first retry wait period will be 100ms. The default backoff function is exponential so subsequent attempts will wait for 200ms, 400ms, 800ms, ..., 102400ms.

## The doWithRetry Function

The function is asynchronous so you must use await when calling it. It can take two arguments:

- A user function to execute and retry
- A set of options to control retry logic (optional)

### The User Function

The user function is passed two parameters.

- The first parameter is a function that is called to signal that the code failed and needs to be retried
- The second parameter is the attempt number. The initial attempt will be 0, the first retry 1, etc.

```javascript
await doWithRetry((retry, attempt) => {
    try {
        return doSomething();
    }
    catch (err) {
        retry(err);
    }
}
```

You may also use an async function.

```javascript
await doWithRetry(async (retry, attempt) => {
    return await doSomethingAsync().catch(retry);
}
```

### The retry Function

You can call `retry` with or without an error parameter. If you are using an `onFail` callback (see options below) and want to know what error happened you should pass it the error you catch.

### Options

You can pass in options to override the default options. Override as many or few as you want. The following options are available.

- maxAttempts: Max number of times to attempt calling the function
- initTimeout: Initial number of ms to wait until retry (note this may be ignored by some backoff functions)
- getNextTimeout: Function that gets the next time to wait in ms
- onFail: Function to be called when an attempt fails
- onSuccess: Function to be called when an attempt succeeds

```javascript
const options = {
    maxAttempts: 3,
    initTimeout: 100,
    getNextTimeout: linearBackoff(100),
    onFail: (error, attempt) => console.log("Attempt", attempt, "failed", error.message),
    onSuccess: (result, attempt) => console.log("Completed after", attempt, "attempts")
};

const result = await doWithRetry(async (retry) => {
    await doSomething().catch(err => {
        if (err.code === 'ETIMEDOUT') {
            retry();
        }
    });
}, options);
```

### Override Default Options

You may want to set your own default options for your entire application. You can override the default options by calling the `overrideDefaultOptions` function. You can override as many or few of the options as you want. All subsequent calls to `doWithRetry` will then use these defaults.

```javascript
overrideDefaultOptions({
    maxAttempts: 5,
    initTimeout: 333,
    getNextTimeout: randomBackoff(1000, 3000)
});
```

_Note: Once you change the default options you can't reset them._

## Backoff Functions

A backoff function determines how long `doWithRetry` will wait before attempting to retry your code. It usually increases upon every retry. This module comes with a number of backoff functions built in.

### Constant

Use this backoff when the timeout should be the same on every retry (_I know, technically it's not a backoff :P_).

`constantBackoff(timeout?: number)`

- timeout: The amount to wait between attempts, if not defined the initial timeout from the options will be used

```
constantBackoff(500); // 500, 500, ...
```

### Linear

The timeout increases linearly. y = mx + b

`linearBackoff(increment: number, maxTimeout?: number)`

- increment: The amount to increase timeout on every retry (slope)
- maxTimeout: An optional max timeout in ms

```
linearBackoff(500, 3000); // 1000, 1500, 2000, 2500, 3000, 3000, ...
```

### Exponential

The timeout increases exponentially. y = x^n + b

`exponentialBackoff(exponent?: number, maxTimeout?: number)`

- exponent: The exponent to use, default is 2
- maxTimeout: An optional max timeout in ms

```
exponentialBackoff(2, 10000); // 1000, 2000, 4000, 8000, 10000, 10000, ...
```

### Upward Decay

The timeout increases using upward exponential decay approaching the max timeout. y = max * (1 - (1 / base ^ x))

`upwardDecayBackoff(maxTimeout: number, base?: number)`

- maxTimeout: The maximum timeout in ms
- rate: The rate to increase, must be greater than 1, default is 2

E.g. When the rate is 2, the timeout will increase half way from the current timeout to the max on every retry.

```
upwardDecayBackoff(1000, 2); // 500, 750, 875, 938, ..., 1000, 1000, ...
```

_Note: When using this the initial timeout defined in options is ignored._

### Fibonacci

The timeout increases using the fibonacci sequence.

`fibonacciBackoff(factor: number, maxTimeout?: number)`

- factor: An amount to multiply fibonacci number by to get timeout in ms, for seconds use 1000
- maxTimeout: An optional max timeout

```
fibonacciBackoff(1000, 8000); // 1000, 2000, 3000, 5000, 8000, 8000, ...
```

_Note: When using this the initial timeout defined in options is ignored._

### Random

The timeout is a random number between min and max.

`randomBackoff(minTimeout: number, maxTimeout: number)`

- minTimeout: Minimum time to wait in ms
- maxTimeout: Maximum time to wait in ms

```
randomBackoff(1000, 5000);
```

_Note: When using this the initial timeout defined in options is ignored._

### Build Your Own

You can use your own custom backoff function if you'd like. The function can accept two parameters:

- curTimeout: The current timeout in ms
- attempt: The attempt number, on the first retry this will be 1

*When attempt is 1 you will usually want to return the current timeout, which is the initial timeout set in options.*

In this example the timeout increases by 50% on each retry.

```javascript
{
    getNextTimeout: (curTimeout, attempt) => {
        if (attempt === 1) return curTimeout;
        else return curTimeout * 1.5;
    }
}
```

## Code Hard