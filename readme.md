# DoWithRetry

This is a simple to use function to help execute code and retry after a certain amount of time if it fails.

Sometimes you may want to execute some code and keep retrying if it fails. For example you may be calling a web service that could fail if you get a bad connection. This module will help you do that.

## Features

- Promise based, works with async code
- Failure is signaled by calling the retry() function that is passed into the user function
- Comes with a set of built in backoff functions, or create your own
- Built in TypeScript type definitions

## Install

`npm i do-with-retry`

## Quick Example

In the simplest example you call `doWithRetry` passing in a function to execute the code you want to try.

```javascript
const result = await doWithRetry((retry) => {
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

When using the default options it will attempt to execute your function a maximum of 10 times and the first wait period will be 1000ms. The default backoff function is exponential so subsequent attempts will wait for 2000ms, 4000ms, 8000ms, etc.

## The doWithRetry Function

The function can take two arguments

- A user function that contains the code to execute and retry
- Set of options to control retry logic

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

If you want to call it with an async function use the async keyword.

```javascript
await doWithRetry(async (retry, attempt) => {
    return await doSomethingAsync().catch(retry);
}
```

### The retry Function

You can call `retry` with or without an error parameter. If you want to know what error happened in your `onFail` callback (see options below) you should pass it the error you catch.

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
    onFail: (error, attempt) => console.log("Attempt failed", attempt, error.message),
    onSuccess: (result, attempt) => console.log("Result", result)
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

The timeout increases linearly.

`linearBackoff(increment: number, maxTimeout?: number)`

- increment: The amount to increase timeout on every retry (slope)
- maxTimeout: An optional max timeout in ms

```
linearBackoff(500, 3000); // 1000, 1500, 2000, 2500, 3000, 3000, ...
```

### Exponential

The timeout increases exponentially.

`exponentialBackoff(exponent?: number, maxTimeout?: number)`

- exponent: The exponent to use, default is 2
- maxTimeout: An optional max timeout in ms

```
exponentialBackoff(2, 10000); // 1000, 2000, 4000, 8000, 10000, 10000, ...
```

### Logarithmic

The timeout increases logarithmically approaching a max timeout.

`logarithmicBackoff(maxTimeout: number, base?: number)`

- maxTimeout: The maximum timeout in ms
- base: The logarithm base, default is 2

```
logarithmicBackoff(1000, 2); // 500, 750, 875, 938, ..., 1000, 1000, ...
```

### Fibonacci

The timeout increases using the fibonacci sequence.

`fibonacciBackoff(factor: number, maxTimeout?: number)`

- factor: An amount to multiply fibonacci number by to get timeout in ms, for seconds use 1000
- maxTimeout: An optional max timeout

```
fibonacciBackoff(1000, 8000); // 1000, 2000, 3000, 5000, 8000, 8000, ...
```

_Note: When using this the initial timeout defined in options not used._

### Random

The timeout is a random number between min and max.

`randomBackoff(minTimeout: number, maxTimeout: number)`

- minTimeout: Minimum time to wait in ms
- maxTimeout: Maximum time to wait in ms

```
randomBackoff(1000, 5000);
```

_Note: When using this the initial timeout defined in options not used._

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