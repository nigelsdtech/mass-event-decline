/*
* Check your google calendar for a particular event and,
* if it's present, use a phone divert service to divert
*
*
*/


var cfg        = require('config');
var log4js     = require('log4js');
var calendarModel = require('calendar-model')


/*
* Initialize
*/


// logs 

log4js.configure(cfg.get('log.log4jsConfigs'));

var log = log4js.getLogger(cfg.get('log.appName'));
log.setLevel(cfg.get('log.level'));




/*
* Main program
*/


log.info('Begin script');
log.info('============');


/*
 * Setup calendar
 */

var calendarParams = {
  name:             "Target Calendar",
  calendarId:       cfg.get('calendarId'),
  googleScopes:     cfg.get('auth.scopes'),
  tokenFile:        cfg.get('auth.tokenFile'),
  tokenDir:         cfg.get('auth.tokenFileDir'),
  clientSecretFile: cfg.get('auth.clientSecretFile'),
  log4js:           log4js,
  logLevel:         cfg.get('log.level')
}
var workPrimary = new calendarModel(calendarParams);


var params = {
  timeMin : cfg.get('declineFrom'),
  timeMax : cfg.get('declineTo')
}

workPrimary.loadEventsFromGoogle(params, function () {
 
  var wpEvs = workPrimary.getEvents();

  for (var i in wpEvs) { 
    var summary   = wpEvs[i].summary;

    var skipEvent = false

    // Skip over exceptions
    var exceptions = cfg.get('exceptionEvents')
    for (var j in exceptions) {
      if (summary == exceptions[j]) {
        log.info('Skipping exception event: ' + workPrimary.getEventString(wpEvs[i]))
        skipEvent = true
      }
    }


    // Delete certain unwanted events
    var deletes = cfg.get('deleteEvents')
    for (var j in deletes) {
      if (summary == deletes[j]) {
        workPrimary.deleteEventFromGoogle(wpEvs[i]);
        skipEvent = true
      }
    }


    if (skipEvent) {
      continue
    }


    var id        = wpEvs[i].id;
    var startTime = wpEvs[i].start.dateTime;
    var endTime   = wpEvs[i].end.dateTime;

    log.debug('Examining: %s', workPrimary.getEventString(wpEvs[i]));

    var attendees = wpEvs[i].attendees;

    // Get users from the attendees list
    log.debug('Attendees are:')
    log.debug(attendees);

    log.trace('Full event details are:')
    log.trace(wpEvs[i]);

    // Loop through the attendees list and identify yourself
    for (var j in attendees) {
      if (attendees[j].self == true) {

        // Skip ones already declined
        if (wpEvs[i].attendees[j].responseStatus == 'declined') {
          log.info('Already declined. Skipping: %s', workPrimary.getEventString(wpEvs[i]))
          continue
        }
        
        wpEvs[i].attendees[j].responseStatus = 'declined';
        wpEvs[i].attendees[j].comment = cfg.get('declineComment');
        
        workPrimary.updateEventOnGoogle(wpEvs[i]);
      }
    }
    
  }

});
