const debug = require('debug')('Bmp180sensor');
const _ = require('lodash');
const delay = require('delay');

const { I2csensor } = require('./lib/i2csensor');
const { oversamplingSettings, registers } = require('./bmp180sensor.constants');

const { bmp180sensorDefaults } = require('./bmp180sensor.defaults');

/**
 * BMP180 Pressure and Temperature Sensor
 *
 * @class Bmp180sensor
 * @extends {I2csensor}
 */
class Bmp180sensor extends I2csensor {
  /**
   *Creates an instance of Bmp180sensor.
   * @param {object|number} bus An i2c-bus Bus class or the number for the bus
   * @param {number} [address=0x77] The I2C address
   * @param {object} options The configuration options
   * @param {object} [options.retryOptions] The promise-retry options {@link https://www.npmjs.com/package/promise-retry} for I2C communications
   * @param {number} [options.retryOptions.retries=10] The maximum amount of times to retry the operation.
   * @param {number} [options.retryOptions.factor=2] The exponential factor to use.
   * @param {number} [options.retryOptions.minTimeout=1000] The number of milliseconds before starting the first retry.
   * @param {number} [options.retryOptions.maxTimeout=Infinity] The maximum number of milliseconds between two retries.
   * @param {boolean} [options.retryOptions.randomize=false] Randomizes the timeouts by multiplying with a factor between 1 to 2.
   * @param {object} [options.oss] The oversampling setting
   * @param {number} options.oss.mode=1 The oversampling setting STANDARD mode
   * @param {number} options.oss.command=0x74 The oversampling setting STANDARD command
   * @param {number} options.oss.delay=8 The oversampling setting STANDARD delay in ms
   * @memberof Bmp180sensor
   */
  constructor(bus, address = 0x77, options) {
    const opts = _.merge({}, bmp180sensorDefaults, options);
    super('BMP180', bus, address, opts);
    this._registers = registers;
    this._calibrationdata = null;
    this._initialized = false;
    debug('Bmp180sensor constructor.');
  }

  /**
   * Calculate the B5 value used to convert raw values to compensated
   * temperature and pressure
   *
   * @param {*} ut Uncompensated temperature value
   * @returns {number} The B5 value used to convert raw values to compensated
   * @memberof Bmp180sensor
   *
   */
  _computeB5(ut) {
    if (!this.isCalibrated) {
      throw new Error('calibrationdata is invalid');
    }

    if (!Number.isInteger(ut)) {
      throw new TypeError(`Invalid Uncompensated Temperature ${ut}`);
    }

    const x1 = Math.floor(((ut - this._calibrationdata.ac6) * this._calibrationdata.ac5) / 2 ** 15);
    const x2 = (this._calibrationdata.mc * 2 ** 11) / (x1 + this._calibrationdata.md);
    const b5 = x1 + x2;
    return b5;
  }

  /**
   * Calculate the compensadate temperature in Celsius
   *
   * @param {number} ut Uncompensated temperature value
   * @returns {number} Temperature in 1 deg C units
   * @memberof Bmp180sensor
   */
  _convertUncompensatedTemperature(ut) {
    if (!Number.isInteger(ut)) {
      throw new TypeError(`Invalid Uncompensated Temperature ${ut}`);
    }
    const b5 = this._computeB5(ut);
    const temperature = Math.floor((b5 + 8) / 2 ** 4);
    return temperature / 10;
  }

  /**
   * Calculate the compensated pressure in Pascal
   *
   * @param {number} ut Uncompensated temperature value
   * @param {number} up Uncompensated pressure value
   * @returns {number} Pressure in Pa
   * @memberof Bmp180sensor
   */
  _convertUncompensatedPressure(ut, up) {
    if (!Number.isInteger(ut)) {
      throw new TypeError(`Invalid Uncompensated Temperature ${ut}`);
    }

    if (!Number.isInteger(up)) {
      throw new TypeError(`Invalid Uncompensated Pressure ${up}`);
    }
    const b5 = this._computeB5(ut);

    /* Pressure compensation */
    const b6 = b5 - 4000;
    let x1 = Math.floor((this._calibrationdata.b2 * Math.floor((b6 * b6) / 2 ** 12)) / 2 ** 11);
    let x2 = Math.floor((this._calibrationdata.ac2 * b6) / 2 ** 11);
    let x3 = x1 + x2;
    const b3 = Math.floor(
      ((this._calibrationdata.ac1 * 4 + x3) * 2 ** this._opts.oss.mode + 2) / 2 ** 2
    );
    x1 = Math.floor((this._calibrationdata.ac3 * b6) / 2 ** 13);
    x2 = Math.floor(Math.floor(this._calibrationdata.b1 * ((b6 * b6) / 2 ** 12)) / 2 ** 16);
    x3 = Math.floor((x1 + x2 + 2) / 2 ** 2);
    const b4 = Math.floor((this._calibrationdata.ac4 * (x3 + 32768)) / 2 ** 15);
    const b7 = (up - b3) * Math.floor(50000 / 2 ** this._opts.oss.mode);
    let p;
    if (b7 < 0x80000000) {
      p = (b7 * 2) / b4;
    } else {
      p = (b7 / b4) * 2;
    }
    x1 = Math.floor(p / 2 ** 8) * Math.floor(p / 2 ** 8);
    x1 = Math.floor((x1 * 3038) / 2 ** 16);
    x2 = Math.floor((-7357 * p) / 2 ** 16);
    const pressure = p + Math.floor((x1 + x2 + 3791) / 2 ** 4);
    return pressure;
  }

  /**
   * Read the uncompensated pressure
   *
   * @throws Will throw an error if invalid response buffer returned
   * @returns {Promise<number>} Returns a Promise that on success will be resolved to the uncompensated pressure (up)
   * @memberof Bmp180sensor
   */
  _getUncompensatedPressure() {
    debug('_getUncompensatedPressure');
    return this._writeI2cByte(this._registers.control, this._opts.oss.command)
      .then(() => {
        return delay(this._opts.oss.delay);
      })
      .then(() => {
        return this._readI2cBlock(this._registers.results, Buffer.alloc(3));
      })
      .then((response) => {
        const responseBuffer = this._validatedBuffer(response.buffer);
        if (responseBuffer.length < 3) {
          throw new Error('Results data not returned');
        }
        const MSB = responseBuffer.readUInt8(0);
        const LSB = responseBuffer.readUInt8(1);
        const XLSB = responseBuffer.readUInt8(2);
        const up = Math.floor(
          (MSB * 2 ** 16 + LSB * 2 ** 8 + XLSB) / 2 ** (8 - this._opts.oss.mode)
        );
        debug('_getUncompensatedPressure (up) %d', up);
        return up;
      });
  }

  /**
   * Read the uncompensated temperature
   *
   * @throws Will throw an error if invalid response buffer returned
   * @returns {Promise<number>} Returns a Promise that on success will be resolved to the uncompensated temperature (ut)
   * @memberof Bmp180sensor
   */
  _getUncompensatedTemperature() {
    debug('_getUncompensatedTemperature');
    return this._writeI2cByte(this._registers.control, oversamplingSettings.temperature.command)
      .then(() => {
        return delay(oversamplingSettings.temperature.delay);
      })
      .then(() => {
        return this._readI2cBlock(this._registers.results, Buffer.alloc(2));
      })
      .then((response) => {
        const responseBuffer = this._validatedBuffer(response.buffer);
        if (responseBuffer.length < 2) {
          throw new Error('Results data not returned');
        }
        const MSB = responseBuffer.readUInt8(0);
        const LSB = responseBuffer.readUInt8(1);
        const ut = MSB * 2 ** 8 + LSB;
        debug('_getUncompensatedTemperature (ut) %d', ut);
        return ut;
      });
  }

  /**
   * Check that sensor is calibrated
   *
   * @readonly
   * @memberof Bmp180sensor
   */
  get isCalibrated() {
    return !_.isNil(this._calibrationdata);
  }

  /**
   * Check that sensor is calibrated
   *
   * @readonly
   * @memberof Bmp180sensor
   */
  get isInitialized() {
    return this._initialized;
  }

  /**
   * Get the oversampling setting value
   *
   * @readonly
   * @memberof Bmp180sensor
   */
  get oss() {
    return this._opts.oss;
  }

  /**
   * Set the oversampling setting value
   *
   * @memberof Bmp180sensor
   */
  set oss(value) {
    this._opts.oss = value;
  }

  /**
   * Validates the chip id is correct for a BMP180 device
   *
   * @returns {Promise<boolean>} Returns a Promise that on success will be resolved to true
   * @throws Will throw if chip id is invalid.
   * @memberof Bmp180sensor
   */
  isValidChipId() {
    debug('checkChipId');
    return this._readI2cByte(this._registers.chipid).then((response) => {
      if (response !== 0x55) {
        throw new Error(
          `Expected BMP180 chip_id to be 0x55, got chip id 0x${response.toString(16)}.`
        );
      }
      return true;
    });
  }

  /**
   * Perform a Soft Reset this will perform the same sequence as power on reset.
   *
   * @returns {Promise<boolean>} Returns a Promise that on success will be resolved to true
   * @memberof Bmp180sensor
   *
   */
  softreset() {
    debug('softreset');
    return this._writeI2cByte(this._registers.softreset, 0xb6).then(() => {
      return true;
    });
  }

  /**
   * Retrieves chip calibration data, and stores in this.calibrationData.
   *
   * @returns {Promise<boolean>} Returns a Promise that on success will be resolved to true
   * @throws Will throw if calibration data returned is invalid.
   * @memberof Bmp180sensor
   *
   */
  calibrate() {
    debug('calibrate');
    const calLength = 22;
    return this._readI2cBlock(this._registers.calibration, Buffer.alloc(calLength)).then(
      (response) => {
        const responseBuffer = this._validatedBuffer(response.buffer);
        if (responseBuffer.length < calLength) {
          throw new Error('Calibration data not returned');
        }

        this._calibrationdata = Object.freeze({
          ac1: responseBuffer.readInt16BE(0),
          ac2: responseBuffer.readInt16BE(2),
          ac3: responseBuffer.readInt16BE(4),
          ac4: responseBuffer.readUInt16BE(6),
          ac5: responseBuffer.readUInt16BE(8),
          ac6: responseBuffer.readUInt16BE(10),
          b1: responseBuffer.readInt16BE(12),
          b2: responseBuffer.readInt16BE(14),
          mb: responseBuffer.readInt16BE(16),
          mc: responseBuffer.readInt16BE(18),
          md: responseBuffer.readInt16BE(20),
        });

        debug('calibrate. data %o', this._calibrationdata);
        return true;
      }
    );
  }

  /**
   * Initializes the sensor, calling:
   * isValidChipId()
   * softReset()
   * calibrate()
   *
   * @returns {Promise<boolean>} Returns a Promise that on success will be resolved to true
   * @memberof Bmp180sensor
   *
   */
  initialize() {
    debug('initialize');
    this._initialized = false;
    return this.isValidChipId()
      .then(() => {
        return this.softreset();
      })
      .then(() => {
        return this.calibrate();
      })
      .then(() => {
        this._initialized = true;
        return this._initialized;
      });
  }

  /**
   * Closes the I2c bus
   *
   * @returns {Promise} Returns a Promise that will be resolved with no arguments
   * @memberof Bmp180sensor
   *
   */
  close() {
    debug('close');
    return this._closeI2c();
  }

  /**
   * Current temperature in Celsius
   *
   * @returns {Promise<number>} Returns a Promise that on success will be resolved to the current temperature in Celsius
   * @memberof Bmp180sensor
   *
   */
  temperature() {
    debug('temperature');
    return new Promise((resolve, reject) => {
      this._getUncompensatedTemperature().then((ut) => {
        try {
          const value = this._convertUncompensatedTemperature(ut);
          debug('temperature. %d C', value);
          resolve(value);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Current pressure in Pascals
   *
   * @returns {Promise<number>} Returns a Promise that on success will be resolved to the current pressure in Pascals
   * @memberof Bmp180sensor
   *
   */
  pressure() {
    debug('pressure');
    return new Promise((resolve, reject) => {
      this._getUncompensatedTemperature().then((ut) => {
        this._getUncompensatedPressure().then((up) => {
          try {
            const value = this._convertUncompensatedPressure(ut, up);
            debug('pressure. %d Pa', value);
            resolve(value);
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }
}

module.exports = {
  Bmp180sensor,
};
