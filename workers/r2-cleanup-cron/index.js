/**
 * r2-cleanup-cron
 * Cron trigger worker to empty 'med-proofs/' R2 directory every 48h
 */

export default {
    async scheduled(event, env, ctx) {
        const BUCKET = env.R2_BUCKET;
        const PREFIX = "med-proofs/";

        let truncated = true;
        let cursor = undefined;
        let deletedCount = 0;

        try {
            console.log(`Starting cleanup of prefix: ${PREFIX}`);

            while (truncated) {
                const list = await BUCKET.list({
                    prefix: PREFIX,
                    cursor: cursor,
                });

                const keysToDelete = list.objects.map(obj => obj.key);

                if (keysToDelete.length > 0) {
                    // Delete objects currently retrieved
                    await Promise.all(keysToDelete.map(key => BUCKET.delete(key)));
                    deletedCount += keysToDelete.length;
                }

                truncated = list.truncated;
                cursor = list.cursor;
            }

            console.log(`Successfully deleted ${deletedCount} proof objects.`);
        } catch (e) {
            console.error("Cleanup cron failed:", e);
        }
    }
};
