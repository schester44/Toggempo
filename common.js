export function addMessageToBody(text) {
  var newP = document.createElement("P");
  newP.style.position = "absolute";
  newP.style.top = "0px";
  newP.style.right = "0px";
  newP.style.fontSize = "150px";

  console.log("add message to body");
  newP.textContent = text;
  document.body.appendChild(newP);
}

export function ExtensionStorage() {
  this.clear = function () {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.clear((items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
        resolve(items);
      });
    });
  };

  this.getDataByKey = function (key) {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.get([key], (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
        resolve(items);
      });
    });
  };

  this.getData = function () {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        }
        resolve(items);
      });
    });
  };

  this.setData = function (items) {
    chrome.storage.sync.set(items, () => {
      console.log("Settings saved");
    });
  };
}

const normalizeEntry = ({ id, guid, start, stop, duration, description }) => ({
  id,
  guid,
  start,
  stop,
  duration,
  description,
});

function getEntryMeta(entry) {
  let [issueKey, description] = (entry.description || "").split(" ");

  if (description) {
    description = entry.description.trim();
  }

  description = description || issueKey;

  return { issueKey, description };
}

function createEntryGroup({ description, workerId, start, issueKey }) {
  const startDay = new Date(start);

  const dtf = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [{ value: mo }, , { value: da }, , { value: ye }] = dtf.formatToParts(
    startDay
  );

  const startTime = `${startDay.getHours()}:${startDay.getMinutes()}:00`;
  const startDate = `${ye}-${mo}-${da}`;

  return {
    entries: [],
    dayOfWeek: startDay,
    log: {
      issueKey,
      description,
      startTime,
      startDate,
      authorAccountId: workerId,
      timeSpentSeconds: 0,
    },
  };
}

export async function getTimeEntries({
  loggedWork = {},
  workerId,
  apiToken,
  startTime,
  endTime,
}) {
  const key = window.btoa(`${apiToken}:api_token`);

  const url = new URL("https://www.toggl.com/api/v8/time_entries");

  const params = {
    start_date: startTime.toISOString(),
    end_date: endTime.toISOString(),
  };

  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );

  const data = await fetch(url, {
    headers: new Headers({
      Authorization: `Basic ${key}`,
    }),
  }).then((res) => res.json());

  let worklog = {};

  for (let entry of data) {
    entry = normalizeEntry(entry);

    const { issueKey, description } = getEntryMeta(entry);

    if (loggedWork[entry.guid]) {
      console.log(`Skipping an existing entry for "${issueKey}".`);
      continue;
    }

    if (!issueKey) {
      console.log("Skipping an entry that does not have an issue key.");
      continue;
    }

    if (!worklog[description]) {
      worklog[description] = createEntryGroup({
        description,
        workerId,
        issueKey,
        start: entry.start,
      });
    }

    worklog[description].entries.push(entry.guid);
    worklog[description].log.timeSpentSeconds += parseInt(entry.duration, 10);
  }

  console.log(worklog);
  return Object.values(worklog);
}
