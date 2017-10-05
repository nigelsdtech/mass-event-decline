'use strict'

/*
* Check your google calendar for a particular event and,
* if it's present, use a phone divert service to divert
*
*
*/


var
  batch         = require('batchflow'),
  calendarModel = require('calendar-model'),
  cfg           = require('config'),
  dateformat    = require('dateformat'),
  log4js        = require('log4js');


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
  clientSecretFile: cfg.auth.clientSecretFile
}
var workPrimary = new calendarModel(calendarParams);


const declineFrom = cfg.declineFrom
     ,declineTo   = cfg.declineTo;

var params = {
  retFields: ["items(attendees(email, responseStatus, self),end,id,start,summary)"],
  timeMin: declineFrom,
  timeMax: declineTo
}

workPrimary.listEvents(params, function (err, wpEvs) {

  if (err) {
    log.error('Error: %s\n%s', err.code, err.stack)
    return null
  }

  var declineComment = cfg.declineComment;
  declineComment = declineComment.replace(/START_DATE/g, dateformat(declineFrom, 'dd/mm'));
  declineComment = declineComment.replace(/END_DATE/g,   dateformat(declineTo,   'dd/mm'));

  log.info('Decline comment: ' + declineComment)


  batch(wpEvs).parallel(10).each( function (i,wpEv,done) {

    var summary = wpEv.summary;

    var evStr = workPrimary.getEventString(wpEv);

    log.info('[%s] Examining: %s', i, evStr);
    log.trace('[%s] Full event details are:\n%s', i, wpEv)

    // Skip over exceptions
    var exceptions = cfg.get('exceptionEvents')
    for (var j = 0; j < exceptions.length; j++) {
      if (summary == exceptions[j]) {
        log.info('[%s] SKIP EXCEPTION: %s ', i, evStr)
        done()
        return null
      }
    }


    // Delete certain unwanted events
    var deletes = cfg.deleteEvents
    for (var j = 0; j < deletes.length; j++) {
      if (summary == deletes[j]) {
        log.info('[%s] DELETE: %s', i, evStr)
        workPrimary.deleteEventFromGoogle(wpEv, function (err) {
          if (err) {
            log.error('[%s] Error deleting event: %s', i, JSON.stringify(err))
          }
          log.info('[%s] Deleted: %s', i, evStr)
	});
        done()
        return null
      }
    }


    var id        = wpEv.id;
    var startTime = wpEv.start.dateTime;
    var endTime   = wpEv.end.dateTime;

    var attendees = wpEv.attendees;

    // Get users from the attendees list
    log.debug('[%s] Attendees are:\n[%s]', i, JSON.stringify(attendees))

    // Loop through the attendees list and identify yourself
    for (var j = 0; j < attendees.length; j++) {

      var attendee = attendees[j]
      var jdx = j

      // Only looking for my own attendence
      if (!attendee.self) { continue }

      log.debug('[%s][%s] Attendee identified: ', i, jdx, attendee.email)

      // Skip ones already declined
      if (attendee.responseStatus == 'declined') {
        log.info('[%s][%s] Already declined. Skipping: %s', i,jdx, evStr)
        done()
        return null
      }

      log.info('[%s][%s] DECLINE: ', i, jdx, evStr)
      workPrimary.updateEvent({
        id: id,
        patchOnly: true,
        resource: {
          attendees: [{
            email: attendee.email,
            responseStatus: "declined",
            comment: declineComment
          }]
        },
        retFields: ["id", "attendees(displayName,responseStatus,comment)"]
      }, function (err, ev) {

        if (err) {
          log.error('[%s][%s] Failed to update event: %s, %s\n', i, jdx, err.code, err.message, err.stack)
          done()
          return null
        }
        
        log.info('[%s][%s] Declined event %s', i, jdx, evStr)
        log.trace('[%s][%s] Declined event %s. Response\n%s', i, jdx, evStr, JSON.stringify(ev))

        done()
        return null
      });

    }

  })
  .end (function() {})

});
