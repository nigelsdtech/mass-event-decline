/*
* Check your google calendar for a particular event and,
* if it's present, use a phone divert service to divert
*
*
*/


const cfg           = require('config')
     ,log4js        = require('log4js')
     ,calendarModel = require('calendar-model')
     ,dateformat    = require('dateformat');


/*
* Initialize
*/


// logs 

log4js.configure(cfg.log.log4jsConfigs);

var log = log4js.getLogger(cfg.log.appName);
log.setLevel(cfg.log.level);




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
  calendarId:       cfg.calendarId,
  googleScopes:     cfg.auth.scopes,
  tokenFile:        cfg.auth.tokenFile,
  tokenDir:         cfg.auth.tokenFileDir,
  clientSecretFile: cfg.auth.clientSecretFile,
  log4js:           log4js,
  logLevel:         cfg.log.level
}
var workPrimary = new calendarModel(calendarParams);


const declineFrom = cfg.declineFrom
     ,declineTo   = cfg.declineTo;

var params = {
  timeMin: declineFrom,
  timeMax: declineTo
}

workPrimary.listEvents(params, function (err, wpEvs) {
 
  if (err) {
    log.error('Error: %s, %s\n%s', err.code, err.message, err.stack)
    return null
  }

  var declineComment = cfg.declineComment;
  declineComment = declineComment.replace(/START_DATE/g, dateformat(declineFrom, 'dd/mm'));
  declineComment = declineComment.replace(/END_DATE/g,   dateformat(declineTo,   'dd/mm'));

  log.info('Decline comment: ' + declineComment)

  for (var i in wpEvs) { 
    var summary   = wpEvs[i].summary;

    var skipEvent = false

    var evStr = workPrimary.getEventString(wpEvs[i]);

    // Skip over exceptions
    var exceptions = cfg.get('exceptionEvents')
    for (var j in exceptions) {
      if (summary == exceptions[j]) {
        log.info('SKIP EXCEPTION: ' + evStr)
        skipEvent = true
      }
    }


    // Delete certain unwanted events
    var deletes = cfg.deleteEvents
    for (var j in deletes) {
      if (summary == deletes[j]) {
        log.info('DELETE: ' + evStr)
        workPrimary.deleteEventFromGoogle(wpEvs[i], function () {});
        skipEvent = true
      }
    }


    if (skipEvent) { continue }


    var id        = wpEvs[i].id;
    var startTime = wpEvs[i].start.dateTime;
    var endTime   = wpEvs[i].end.dateTime;

    log.debug('Examining: %s', evStr);

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
          log.info('Already declined. Skipping: %s', evStr)
          continue
        }
        
        wpEvs[i].attendees[j].responseStatus = 'declined';
        wpEvs[i].attendees[j].comment = declineComment;
        
        log.info('DECLINE: ' + evStr)
	workPrimary.updateEvent({
          id: id,
          resource: wpEvs[i],
          retFields: ["id", "attendees(displayName,responseStatus,comment)"]
	}, function (err, ev) {

	  if (err) {
	    log.error('Failed to update event: %s, %s\n', err.code, err.message, err.stack)
	    return null
          }
	  log.info('Updated event %s', evStr)
	  log.trace('Updated event %s. Response\n%s', evStr, JSON.stringify(ev))
	});

        break;
      }
    }
    
  }

});
