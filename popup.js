import { React, ReactDOM } from "https://unpkg.com/es-react@16.12.0/index.js";
import "https://unpkg.com/htm@2.2.1";

import { ExtensionStorage, getTimeEntries } from "./common.js";

const html = htm.bind(React.createElement);
const render = ReactDOM.render;

var extensionStorage = new ExtensionStorage();

function Auth({ onAuth }) {
  const [state, setState] = React.useState({
    email: "",
    password: "",
    tempoApiKey: "",
    tempoWorkerId: "",
  });

  const handleChange = ({ target: { name, value } }) => {
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    fetch("https://www.toggl.com/api/v8/me", {
      headers: new Headers({
        Authorization: `Basic ${btoa(`${state.email}:${state.password}`)}`,
      }),
    })
      .then((res) => res.json())
      .then(({ data }) => {
        console.log({
          togglToken: data.api_token,
          tempoApiKey: state.tempoApiKey,
          tempoWorkerId: state.tempoWorkerId,
        });

        extensionStorage.setData({
          togglToken: data.api_token,
          tempoApiKey: state.tempoApiKey,
          tempoWorkerId: state.tempoWorkerId,
        });

        onAuth();
      })
      .catch((e) => {
        console.log(e);
      });
  };

  const isValid =
    state.email.trim().length > 0 &&
    state.password.trim().length > 0 &&
    state.tempoApiKey.trim().length > 0 &&
    state.tempoWorkerId.trim().length > 0;

  return html`
    <div>
      <h1>Authentication</h1>

      <form>
        <h3>Toggl</h3>
        <div>
          <label htmlFor="email">Toggl Email</label>
          <input type="text" name="email" onChange=${handleChange} />
        </div>
        <div>
          <label htmlFor="password">Toggl Password</label>

          <input type="password" name="password" onChange=${handleChange} />
        </div>

        <h3>Tempo</h3>
        <div>
          <label htmlFor="tempoApiKey">Tempo API Key</label>
          <input type="text" name="tempoApiKey" onChange=${handleChange} />
        </div>

        <div>
          <label htmlFor="tempoWorkerId">Tempo Worker ID</label>
          <input type="text" name="tempoWorkerId" onChange=${handleChange} />
        </div>
      </form>

      <button className="primary" onClick=${handleSubmit} disabled=${!isValid}>
        Authenticate
      </button>
    </div>
  `;
}

function logToTempo(data, { apiKey }) {
  return fetch("https://api.tempo.io/core/3/worklogs", {
    method: "post",
    headers: new Headers({
      Authorization: `Bearer ${apiKey}`,
    }),
    body: JSON.stringify(data),
  }).then((res) => res.json());
}

const formatDate = (date) => {
  const dtf = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: mo }, , { value: da }, , { value: ye }] = dtf.formatToParts(
    date
  );

  return `${ye}-${mo}-${da}`;
};

function Settings({ onLogOut }) {
  const [showTime, setShowTime] = React.useState(false);
  const [time, setTime] = React.useState(formatDate(new Date()));

  const [state, setState] = React.useState({
    isRunning: false,
    hasRun: false,
    entries: [],
  });

  const logout = () => {
    extensionStorage.clear();
    onLogOut();
  };

  const handleSubmit = async () => {
    const data = await extensionStorage.getData();

    const startTime = new Date();
    const endTime = new Date();

    startTime.setHours(0, 0, 0, 0);
    endTime.setHours(23, 59, 0, 0);

    const worklog = await getTimeEntries({
      loggedWork: extensionStorage.getDataByKey("loggedWork"),
      workerId: data.tempoWorkerId,
      apiToken: data.togglToken,
      startTime,
      endTime,
    });

    let totalSeconds = 0;
    let dayOfWeek;

    const apiKey = data.tempoApiKey;

    setState((prev) => ({ ...prev, isRunning: true }));

    for (let work of worklog) {
      if (!dayOfWeek) {
        dayOfWeek = work.dayOfWeek;
      }

      try {
        // let x = await logToTempo(work.log, { apiKey });

        setState((prev) => ({
          ...prev,
          entries: prev.entries.concat(work.log),
        }));

        totalSeconds += work.log.timeSpentSeconds;

        const loggedWork = await extensionStorage.getDataByKey("loggedWork");

        work.entries.forEach((entry) => {
          loggedWork[entry] = true;
        });

        await extensionStorage.setData({ loggedWork });
      } catch (error) {
        const message =
          error.response && error.response.data && error.response.data.errors
            ? error.response.data.errors[0].message
            : error.message;

        console.log(
          `Failed to create a worklog for "${work.log.description}" (${message})`
        );
      }
    }

    setState((prev) => ({ ...prev, isRunning: false, hasRun: true }));

    if (worklog.length > 0) {
      console.log("logged total seconds", totalSeconds);
    } else {
      console.log("no entries to log");
    }

    // setShowTime(false);
  };

  if (showTime) {
    return html`
      <div>
        <div style=${{ padding: 10 }}>
          ${state.entries.map((entry) => {
            return html`
              <div style=${{ marginBottom: 4 }}>
                <span style=${{ color: "green", marginRight: 4 }}>✔</span>
                <strong>${entry.issueKey}</strong> - ${entry.description}
              </div>
            `;
          })}
        </div>

        ${state.hasRun && html`
        <button className="primary" onClick=${() => window.close()}>Close</button>
        `}

        ${!state.isRunning &&
        !state.hasRun &&
        html` <div>
          <div style=${{ marginBottom: 12 }}>
            <input
              type="text"
              value=${time}
              onChange=${({ target: { value } }) => setTime(value)}
            />
          </div>

          <button className="primary" onClick=${handleSubmit}>GO!</button>

          <button
            className="secondary"
            style=${{ marginLeft: 5 }}
            onClick=${() => setShowTime(false)}
          >
            Cancel
          </button>
        </div>`}
      </div>
    `;
  }

  return html`<div>
    <h1 className="title">Toggempo</h1>

    <button
      className="primary"
      style=${{ marginRight: 5 }}
      onClick=${() => {
        setShowTime(true);
        setState({ entries: [] });
      }}
    >
      Log Time
    </button>
    <button className="secondary" onClick=${logout}>Sign Out</button>
  </div>`;
}

function App({ defaultIsAuthed }) {
  const [isAuthed, setState] = React.useState(defaultIsAuthed);

  if (!isAuthed) return html`<${Auth} onAuth=${() => setState(true)} />`;

  return html`<${Settings} onLogOut=${() => setState(false)} />`;
}

async function main() {
  const items = await extensionStorage.getData();

  render(
    html`<${App} defaultIsAuthed=${!!items.tempoApiKey} />`,
    document.getElementById("root")
  );
}

main();
