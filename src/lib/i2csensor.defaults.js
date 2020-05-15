/**
 * @typedef i2csensorDefaults
 * @type {object}
 * @property {object} retryOptions The promise-retry options {@link https://www.npmjs.com/package/promise-retry} for I2C communications
 * @property {number} retryOptions.retries=10 The maximum amount of times to retry the operation.
 * @property {number} retryOptions.factor=2 The exponential factor to use.
 * @property {number} retryOptions.minTimeout=1000 The number of milliseconds before starting the first retry.
 * @property {number} retryOptions.maxTimeout=Infinity The maximum number of milliseconds between two retries.
 * @property {boolean} retryOptions.randomize=false Randomizes the timeouts by multiplying with a factor between 1 to 2.
 */
const i2csensorDefaults = {
  retryOptions: {
    retries: 10,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: Infinity,
    randomize: false,
  },
};

module.exports = {
  i2csensorDefaults,
};
