import { PORT, HOST, OUTPUT_DIR, RENDERS_DIR, SECURITY } from "./lib/config.js";
import { runPipeline } from "./lib/pipeline.js";
import { VOICES } from "./lib/tts.js";
import { uploadConfigured } from "./lib/upload.js";
import { Scheduler } from "./lib/scheduler.js";
import { addBriefing, listBriefings, removeBriefing } from "./lib/history.js";

import { createApp } from "./app.js";

const { app, scheduler } = createApp({
  config: { ...SECURITY, outputDir: OUTPUT_DIR, rendersDir: RENDERS_DIR },
  runPipeline, VOICES, uploadConfigured, Scheduler, addBriefing, listBriefings, removeBriefing,
});
await scheduler.init();
app.listen(PORT, HOST, () => console.log(`News Globe server → http://${HOST}:${PORT}`));
