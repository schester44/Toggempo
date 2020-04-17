import { React, ReactDOM } from "https://unpkg.com/es-react@16.12.0/index.js";
import "https://unpkg.com/htm@2.2.1";

import { ExtensionStorage } from "./common.js";

const html = htm.bind(React.createElement);
const render = ReactDOM.render;

var extensionStorage = new ExtensionStorage();

const styles = {
  position: "absolute",
  top: 0,
  right: 0,
  width: 400,
  height: 400,
  background: "red",
  fontSize: 32,
  color: "red",
};

function App() {
  return html`<div style=${styles}></div>`;
}

const $elem = document.createElement("div");

$elem.setAttribute("id", "my-toggl-app");

document.body.appendChild($elem);

let $root = document.querySelector(".TimerFormProject__container");

// while (!$root) {
//   $root = document.querySelector(".TimerFormProject__container");
// }

async function main() {
  render(html`<${App} />`, $root);
}

main();
