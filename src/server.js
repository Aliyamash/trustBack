import { createApp } from "./app.js";
import { config } from "./config.js";

createApp().listen(config.port, config.host, () => {
  console.log(`Trustence API listening on http://${config.host}:${config.port}`);
});
