import "./style.css";
import { start } from "./ui/app";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing");
start(app);
