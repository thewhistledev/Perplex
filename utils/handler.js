const { Log } = require('./loghandler');

/**
 * Prevents the app from hanging when an error occurs.
 * @returns {function}
 */
function preventCrash() {
    process.on('uncaughtException', (err, origin) => {
        Log(3, `Caught exception: ${err}\n` + `Exception Type: ${origin}`, 'error');
      });

    process.on('unhandledRejection', (reason, promise) => {
        Log(3, 'Unhandled Rejection at:' + {...promise} + '\nReason:' + reason, 'error');
    });
}
module.exports = preventCrash();