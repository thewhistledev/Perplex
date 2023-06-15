/**
 * @fileoverview This file contains the log handler for the application.
 * @module utils/loghandler
 */

/**
 * Logs a message to the console.
 * @param {string} traceLevel - The level of the message.
 * @param {string} traceMessage - The message to log.
 * @returns {void}
 * @example
 * Log('INFO', 'This is an info message');
 * Log('WARN', 'This is a warning message');
 * Log('ERROR', 'This is an error message');
 * Log('DEBUG', 'This is a debug message');
 * 
 * // Output:
 * // [INFO]: This is an info message
 * // [WARN]: This is a warning message
 * // [ERROR]: This is an error message
 * // [DEBUG]: This is a debug message
*/
function Log(traceLevel, traceMessage){
    console.log(`[${traceLevel.toUpperCase()}]: ${traceMessage}`);
}

module.exports = { Log };