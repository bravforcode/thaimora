import * as fs from "node:fs";
import * as path from "node:path";
import { getWolfDir, ensureWolfDir, stripGeneratedSnapshots, readJSON, writeJSON, appendMarkdown, timeShort } from "./shared.js";
async function main() {
    ensureWolfDir();
    stripGeneratedSnapshots();
    const wolfDir = getWolfDir();
    const hooksDir = path.join(wolfDir, "hooks");
    const sessionFile = path.join(hooksDir, "_session.json");
    const session = readJSON(sessionFile, {
        session_id: "",
        started: "",
        files_read: {},
        files_written: [],
        edit_counts: {},
        anatomy_hits: 0,
        anatomy_misses: 0,
        repeated_reads_warned: 0,
        cerebrum_warnings: 0,
        stop_count: 0,
    });
    session.stop_count++;
    // Only write to ledger if there's been activity
    const readCount = Object.keys(session.files_read).length;
    const writeCount = session.files_written.length;
    if (readCount === 0 && writeCount === 0) {
        writeJSON(sessionFile, session);
        process.exit(0);
        return;
    }
    // Check for files edited many times without a buglog entry
    checkForMissingBugLogs(wolfDir, session);
    // Check if cerebrum was updated this session (it should be if there were edits)
    checkCerebrumFreshness(wolfDir, session);
    // Build session entry for ledger
    const reads = Object.entries(session.files_read).map(([file, data]) => ({
        file,
        tokens_estimated: data.tokens,
        was_repeated: data.count > 1,
        repeat_count: Math.max(1, data.count),
        anatomy_had_description: data.anatomy_had_description === true,
    }));
    const writes = session.files_written.map((w) => ({
        file: w.file,
        tokens_estimated: w.tokens,
        action: w.action,
    }));
    const inputTokens = reads.reduce((sum, r) => sum + r.tokens_estimated, 0);
    const outputTokens = writes.reduce((sum, w) => sum + w.tokens_estimated, 0);
    const sessionEntry = {
        id: session.session_id,
        started: session.started,
        ended: new Date().toISOString(),
        reads,
        writes,
        totals: {
            input_tokens_estimated: inputTokens,
            output_tokens_estimated: outputTokens,
            reads_count: readCount,
            writes_count: writeCount,
            repeated_reads_warned: session.repeated_reads_warned,
            repeated_reads_blocked: 0,
            anatomy_lookups: session.anatomy_hits,
        },
    };
    // Update token-ledger.json
    const ledgerPath = path.join(wolfDir, "token-ledger.json");
    const ledger = readJSON(ledgerPath, {
        version: 1,
        created_at: "",
        lifetime: {
            total_tokens_estimated: 0,
            total_reads: 0,
            total_writes: 0,
            total_sessions: 0,
            anatomy_hits: 0,
            anatomy_misses: 0,
            repeated_reads_blocked: 0,
            estimated_savings_vs_bare_cli: 0,
        },
        sessions: [],
        daemon_usage: [],
        waste_flags: [],
        optimization_report: { last_generated: null, patterns: [] },
    });
    const previousIndex = ledger.sessions.findIndex((entry) => entry.id === sessionEntry.id);
    const previous = previousIndex >= 0 ? ledger.sessions[previousIndex] : null;
    if (previous) {
        const previousTotals = previous.totals;
        ledger.lifetime.total_reads -= previousTotals.reads_count;
        ledger.lifetime.total_writes -= previousTotals.writes_count;
        ledger.lifetime.total_tokens_estimated -=
            previousTotals.input_tokens_estimated + previousTotals.output_tokens_estimated;
        ledger.lifetime.anatomy_hits -= previousTotals.anatomy_lookups;
        ledger.lifetime.anatomy_misses -= previous.reads.filter((read) => !read.anatomy_had_description).length;
        ledger.lifetime.repeated_reads_warned =
            (ledger.lifetime.repeated_reads_warned ?? 0) -
                (previousTotals.repeated_reads_warned ?? 0);
        ledger.sessions[previousIndex] = sessionEntry;
    }
    else {
        if (typeof ledger.lifetime.total_sessions === "number" &&
            ledger.lifetime.total_sessions !== ledger.sessions.length &&
            ledger.lifetime.legacy_total_sessions === undefined) {
            ledger.lifetime.legacy_total_sessions = ledger.lifetime.total_sessions;
        }
        ledger.lifetime.total_sessions = ledger.sessions.length + 1;
        ledger.sessions.push(sessionEntry);
    }
    ledger.lifetime.total_reads += readCount;
    ledger.lifetime.total_writes += writeCount;
    ledger.lifetime.total_tokens_estimated += inputTokens + outputTokens;
    ledger.lifetime.anatomy_hits += session.anatomy_hits;
    ledger.lifetime.anatomy_misses += session.anatomy_misses;
    ledger.lifetime.repeated_reads_warned =
        (ledger.lifetime.repeated_reads_warned ?? 0) + session.repeated_reads_warned;
    writeJSON(ledgerPath, ledger);
    // Write a session summary line to memory.md if there was meaningful activity
    if (writeCount > 0 && session.stop_count === 1) {
        try {
            const uniqueFiles = new Set(session.files_written.map(w => path.basename(w.file)));
            const fileList = [...uniqueFiles].slice(0, 5).join(", ");
            const memoryPath = path.join(wolfDir, "memory.md");
            appendMarkdown(memoryPath, `| ${timeShort()} | Session end: ${writeCount} writes across ${uniqueFiles.size} files (${fileList}) | ${readCount} reads | ~${inputTokens + outputTokens} tok |\n`);
        }
        catch { }
    }
    writeJSON(sessionFile, session);
    process.exit(0);
}
/**
 * Check if files were edited multiple times but buglog.json wasn't updated.
 * Emit a stderr reminder so Claude sees it in the next turn.
 */
function checkForMissingBugLogs(wolfDir, session) {
    if (!session.edit_counts)
        return;
    const multiEditFiles = Object.entries(session.edit_counts)
        .filter(([, count]) => count >= 3)
        .map(([file]) => path.basename(file));
    if (multiEditFiles.length === 0)
        return;
    // Check if buglog was written to this session
    const buglogWritten = session.files_written.some(w => w.file.includes("buglog.json"));
    if (!buglogWritten) {
        process.stderr.write(`⚠️ OpenWolf: Files edited 3+ times this session (${multiEditFiles.join(", ")}) but buglog.json was not updated. If you fixed bugs, please log them.\n`);
    }
}
/**
 * Check if cerebrum.md was updated recently. If it hasn't been updated in
 * a while and there was significant activity, emit a gentle reminder.
 */
function checkCerebrumFreshness(wolfDir, session) {
    const cerebrumPath = path.join(wolfDir, "cerebrum.md");
    try {
        const stat = fs.statSync(cerebrumPath);
        const hoursSinceUpdate = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
        // If cerebrum hasn't been updated in 24h+ and there were significant writes
        if (hoursSinceUpdate > 24 && session.files_written.length >= 3) {
            process.stderr.write(`💡 OpenWolf: cerebrum.md hasn't been updated in ${Math.floor(hoursSinceUpdate)}h. Did you learn any user preferences, conventions, or gotchas this session? Consider updating .wolf/cerebrum.md.\n`);
        }
    }
    catch {
        // cerebrum.md doesn't exist, that's ok
    }
}
main().catch(() => process.exit(0));
//# sourceMappingURL=stop.js.map