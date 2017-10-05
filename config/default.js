var cfg   = require('config');
var defer = require('config/defer').deferConfig;

module.exports = {

  // ***********Everything within these lines need to be overridden
  exceptionEvents: ["The calendar summary of an event that won't be deleted", "The calendar summary of another event that won't be deleted", "Important recurring event you never want to reject"],
  deleteEvents: ["The calendar summary of some event you just want to delete (rather than reject)"],
  declineFrom: "2017-10-05 00:00:00",
  declineTo:  "2017-10-05 23:59:59",
  // Note that on this line START_DATE and END_DATE will be substituted in by the code with the declineFrom and declineTo respectively
  declineComment: "On annual leave from START_DATE to END_DATE (inclusive)",
  // ***********


  appName: process.env.npm_package_config_appName,

  auth: {
    credentialsDir:   process.env.HOME+"/.credentials",
    clientSecretFile: defer( function (cfg) { return cfg.auth.credentialsDir+"/client_secret.json" } ),
    tokenFileDir:     defer( function (cfg) { return cfg.auth.credentialsDir } ),
    tokenFile:        defer( function (cfg) { return "access_token_"+cfg.appName+".json" } ),
    scopes:           process.env.npm_package_config_googleAuthScopes.split(",")
  },

  calendarId: "primary",

  log: {
    appName: defer(function (cfg) { return cfg.appName } ),
    level:   "INFO",
    log4jsConfigs: {
      appenders: [
        {
          type:       "file",
          filename:   defer(function (cfg) { return cfg.log.logDir.concat("/" , cfg.appName , ".log" ) }),
          category:   defer(function (cfg) { return cfg.appName }),
          reloadSecs: 60,
          maxLogSize: 1024000
        },
        {
          type: "console"
        }
      ],
      replaceConsole: true
    },
    logDir: "./logs"
  }
} 
