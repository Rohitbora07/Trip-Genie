import { env } from "./config/env";
import app from "./app";
import { recoverStaleGenerationJobs } from "./modules/generation-jobs/generation-job.worker";

async function startServer() {
    try {
        const recovery = await recoverStaleGenerationJobs();
        if (recovery.failedStaleProcessing > 0 || recovery.requeuedPending > 0) {
            console.log(
                `Recovered generation jobs on startup: ${recovery.failedStaleProcessing} stale processing marked FAILED, ${recovery.requeuedPending} pending re-queued`
            );
        }
    } catch (error) {
        console.error("Failed to recover stale generation jobs on startup:", error);
    }

    app.listen(env.PORT, () => {
        console.log(`Server is running on port ${env.PORT}`);
    });
}

void startServer();

