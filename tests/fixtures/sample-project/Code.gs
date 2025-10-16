const BUILD_ID = 'fixture-build';

function envelope_(status, data, phase, startTime) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
  };

  if (phase) {
    response.phase = phase;
  }

  if (startTime) {
    response.ms = Date.now() - startTime;
  }

  return { ...response, ...data };
}

function ok_(data, phase) {
  return envelope_(200, data, phase);
}

function notModified_(etag) {
  return envelope_(304, { etag, notModified: true });
}

function calculateBackoffSchedule_(attempt) {
  const schedule = [];
  for (let i = 0; i <= attempt + 2; i += 1) {
    schedule.push(Math.min(30 * Math.pow(2, i), 600));
  }
  return schedule;
}

function rateLimited_(retryAfterSeconds, attemptNumber) {
  return envelope_(
    429,
    {
      rateLimit: {
        retryAfterSeconds,
        attemptNumber,
        backoffSchedule: calculateBackoffSchedule_(attemptNumber),
      },
    },
    'rate-limited'
  );
}

function serverError_(error, phase) {
  return envelope_(500, { error: String(error) }, phase || 'error');
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify(ok_({ message: 'ok' })));
}

function createEventbook() {
  return ok_({ id: Utilities.getUuid() }, 'create');
}

function getEventsSafe() {
  return ok_({ events: [] }, 'index');
}

function ping() {
  return ok_({ status: 'ok' }, 'health');
}
