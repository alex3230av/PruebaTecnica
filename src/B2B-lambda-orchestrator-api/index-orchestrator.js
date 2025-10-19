import app from './orchestrator.app.js';

const port = Number(process.env.ORCHESTRATOR_PORT || 3000);
app.listen(port, () => console.log(`Orchestrator API on :${port}`));
