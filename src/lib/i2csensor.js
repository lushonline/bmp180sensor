const { openSync } = require('i2c-bus');
const debug = require('debug')('I2csensor');
const PromiseRetry = require('promise-retry');
const _ = require('lodash');

const { i2csensorDefaults } = require('./i2csensor.defaults');

/**
 * I2csensor Base Class
 *
 * @class I2csensor
 */
class I2csensor {
  /**
   *Creates an instance of I2csensor.
   * @param {string} name The name for the Sensor
   * @param {object|number} bus An i2c-bus Bus class or the number for the bus
   * @param {number} address The I2C address
   * @param {i2csensorDefaults} options The configuration options
   *
   * @memberof I2csensor
   */
  constructor(name, bus, address, options) {
    this._name = name;
    this._address = this._validatedAddress(address);

    this._bus = null;
    this._busnumber = null;

    this._validbus = false;

    switch (typeof bus) {
      case 'object':
        this._busnumber = null;
        this._bus = this._validatedBus(bus).promisifiedBus();
        this._validbus = true;
        break;
      case 'number':
        this._busnumber = this._validatedBusnumber(bus);
        this._bus = openSync(this._busnumber).promisifiedBus();
        this._validbus = true;
        break;
      default:
        // code block
        this._validbus = false;
        this._busnumber = null;
        this._bus = null;
        throw new TypeError('Invalid bus it must a number or an i2c-bus.Bus');
    }

    this._opts = _.merge({}, i2csensorDefaults, options);
  }

  get name() {
    return this._name;
  }

  /**
   * Get the current chip address to use, return as Base 10
   *
   * @memberof I2csensor
   */
  get address() {
    return this._address;
  }

  /**
   * Set the current chip address to use
   *
   * @memberof I2csensor
   */
  set address(value) {
    this._address = this._validatedAddress(value);
  }

  /**
   * Confirm a Valid I2C Bus has been supplied
   *
   * @readonly
   * @memberof I2csensor
   */
  get isValidBus() {
    return this._validbus;
  }

  /**
   * Confirm a Valid bus parameter
   *
   * @param {*} bus Validates the bus supplied is valid
   * @throws Will throw an error if invalid.
   * @returns {object}
   *
   * @memberof I2csensor
   */
  _validatedBus = (bus) => {
    if (_.isNil(bus)) {
      throw new TypeError('Invalid bus it must a number or an i2c-bus.Bus');
    }
    if (bus.constructor.name !== 'Bus') {
      throw new TypeError('Invalid bus it must a number or an i2c-bus.Bus');
    }
    return bus;
  };

  /**
   * Confirm a Valid bus number parameter
   *
   * @param {*} busnumber Validates the bus number is valid
   * @throws Will throw an error if invalid.
   * @returns {number}
   *
   * @memberof I2csensor
   */
  _validatedBusnumber = (busnumber) => {
    if (!Number.isInteger(busnumber) || busnumber < 0) {
      throw new TypeError(`Invalid I2C bus number ${busnumber}`);
    }
    return busnumber;
  };

  /**
   * Confirm a Valid I2C address
   *
   * @param {*} address Validates the address is valid
   * @throws Will throw an error if invalid.
   * @returns {number}
   *
   * @memberof I2csensor
   */
  _validatedAddress = (address) => {
    if (!Number.isInteger(address) || address < 0 || address > 0x7f) {
      throw new TypeError(`Invalid I2C address ${address}`);
    }
    return address;
  };

  /**
   * Confirm a Valid I2C command/register
   *
   * @param {*} command Validates the command is valid
   * @throws Will throw an error if invalid.
   * @returns {number}
   *
   * @memberof I2csensor
   */
  _validatedCommand = (command) => {
    if (!Number.isInteger(command) || command < 0 || command > 0xff) {
      throw new TypeError(`Invalid I2C command ${command}`);
    }
    return command;
  };

  /**
   * Confirm a Valid Buffer
   *
   * @param {*} buffer Validates the buffer is a valid buffer
   * @throws Will throw an error if invalid.
   * @returns {Buffer}
   *
   * @memberof I2csensor
   */
  _validatedBuffer = (buffer) => {
    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError(`Invalid buffer ${buffer}`);
    }
    return buffer;
  };

  /**
   * Read a byte from the specified command/register
   *
   * @param {integer} command The command/register to read from
   * @throws Will throw an error if invalid command/register
   * @returns {Promise<number>} Promise that will be resolved with an unsigned integer (byte) in the range 0 to 255 on success.
   * @memberof I2csensor
   */
  _readI2cByte(command) {
    const cmd = this._validatedCommand(command);
    debug('readI2cByte. address: %h command: %h', this._address, cmd);
    return PromiseRetry((retry, number) => {
      debug('readBreadI2cByteyte. attempt: %d', number);
      return this._bus.readByte(this._address, cmd).catch((err) => {
        debug('readI2cByte. error: %o', err);
        retry();
      });
    }, this._opts.retryOptions);
  }

  /**
   * Write a byte to the specified command/register
   *
   * @param {integer} command The command/register to write to
   * @param {integer} byte The value to write
   * @returns {Promise} Promise that will be resolved with no arguments on success.
   * @throws Will throw an error if invalid command/register
   * @memberof I2csensor
   */
  _writeI2cByte(command, byte) {
    const cmd = this._validatedCommand(command);
    debug('writeI2cByte. address: %h command: %h byte: %h', this._address, cmd, byte);
    return PromiseRetry((retry, number) => {
      debug('writeI2cByte. attempt: %d', number);
      return this._bus.writeByte(this._address, cmd, byte).catch((err) => {
        debug('writeI2cByte. error: %o', err);
        retry();
      });
    }, this._opts.retryOptions);
  }

  /**
   * Read a buffer from the specified command/register
   *
   * @param {integer} command The command/register to read from
   * @param {Buffer} buffer The buffer to read
   * @throws Will throw an error if invalid command/register
   * @throws Will throw an error if invalid buffer
   * @returns {Promise<{bytesRead: number, buffer: Buffer}>} Returns a Promise that on success will be resolved with an object with a bytesRead property identifying the number of bytes read, and a buffer property contiining the read block.
   */
  _readI2cBlock(command, buffer) {
    const cmd = this._validatedCommand(command);
    const buff = this._validatedBuffer(buffer);
    const { length } = buff;
    debug('readI2cBlock. address: %h command: %h length: %h', this._address, cmd, length);
    return PromiseRetry((retry, number) => {
      debug('readI2cBlock. attempt: %d', number);
      return this._bus.readI2cBlock(this._address, cmd, length, buff).catch((err) => {
        debug('readI2cBlock. error: %o', err);
        retry();
      });
    }, this._opts.retryOptions);
  }

  /**
   * Write a buffer to the specified command/register
   *
   * @param {integer} command The command/register to write to
   * @param {Buffer} buffer The buffer to write
   * @throws Will throw an error if invalid command/register
   * @throws Will throw an error if invalid buffer
   * @returns {Promise<{bytesWritten: number, buffer: Buffer}>} Returns a Promise that on success will be resolved with an object with a bytesWritten property identifying the number of bytes written, and a buffer property that is data written.
   * @memberof I2csensor
   */
  _writeI2cBlock(command, buffer) {
    const cmd = this._validatedCommand(command);
    const buff = this._validatedBuffer(buffer);
    const { length } = buff;
    debug('writeI2cBlock. address: %h command: %h length: %h', this._address, cmd, length);
    return PromiseRetry((retry, number) => {
      debug('writeI2cBlock. attempt: %d', number);
      return this._bus.writeI2cBlock(this._address, cmd, length, buff).catch((err) => {
        debug('writeI2cBlock. error: %o', err);
        retry();
      });
    }, this._opts.retryOptions);
  }

  /**
   * Close the bus if created by sensor
   *
   * @returns {Promise<boolean>} Returns a Promise that will be resolved to true if bus created by sensor and closed successfully, or resolve to false if bus not created by sensor.
   * @memberof I2csensor
   */
  _closeI2c() {
    debug('closeI2c');
    return new Promise((resolve, reject) => {
      if (_.isNil(this._busnumber)) {
        resolve(false);
        return;
      }

      this._bus
        .close()
        .then(() => {
          resolve(true);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

module.exports = {
  I2csensor,
};
