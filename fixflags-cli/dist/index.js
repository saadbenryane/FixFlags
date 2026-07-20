#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
const CONFIG_PATH = join(homedir(), '.fixflags');
const API_BASE = process.env.FIXFLAGS_API_URL || 'https://fixflags.com';
function loadConfig() {
    if (existsSync(CONFIG_PATH)) {
        try {
            return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
        }
        catch {
            return {};
        }
    }
    return {};
}
function saveConfig(config) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
let rpcId = 1;
async function callMcpTool(tool, args, apiKey) {
    const res = await fetch(`${API_BASE}/api/mcp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-api-key': apiKey,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: rpcId++,
            method: 'tools/call',
            params: { name: tool, arguments: args },
        }),
    });
    const body = (await res.json().catch(() => null));
    if (!res.ok) {
        throw new Error(body?.error?.message || `API error ${res.status}`);
    }
    if (body?.error) {
        throw new Error(body.error.message || 'MCP tool error');
    }
    const text = body?.result?.content?.find((c) => c.type === 'text')?.text;
    if (!text) {
        throw new Error('Empty MCP response');
    }
    try {
        return JSON.parse(text);
    }
    catch {
        return { raw: text };
    }
}
const RUBRIC_COLORS = {
    MESSAGE: chalk.magenta,
    EXPERIENCE: chalk.cyan,
    REACH: chalk.yellow,
    Message: chalk.magenta,
    Experience: chalk.cyan,
    Reach: chalk.yellow,
};
const SEVERITY_COLORS = {
    CRITICAL: chalk.bgRed.white,
    IMPORTANT: chalk.red,
    POLISH: chalk.yellow,
};
function formatFlag(flag) {
    const sevColor = SEVERITY_COLORS[flag.severity] || chalk.white;
    const lines = [
        `  ${sevColor(flag.severity.padEnd(10))} ${chalk.white(flag.problem)}`,
        `  ${chalk.gray('Rubric:')} ${flag.rubric}`,
    ];
    if (flag.fix) {
        const preview = flag.fix.slice(0, 120);
        lines.push(`  ${chalk.green('Fix:')} ${chalk.gray(preview)}${flag.fix.length > 120 ? '...' : ''}`);
    }
    return lines.join('\n');
}
const program = new Command();
program
    .name('fixflags')
    .description('FixFlags CLI — QA for AI-built products')
    .version('0.1.0');
program
    .command('auth')
    .description('Authenticate with FixFlags')
    .option('--api-key <key>', 'API key from fixflags.com/settings')
    .action(async (opts) => {
    const config = loadConfig();
    const apiKey = opts.apiKey || config.apiKey;
    if (apiKey) {
        config.apiKey = apiKey;
        saveConfig(config);
        console.log(chalk.green('Authenticated with FixFlags.'));
        return;
    }
    console.log(chalk.yellow('Get your API key at: https://fixflags.com/settings'));
    console.log(chalk.gray('Then run: fixflags auth --api-key <your-key>'));
});
program
    .command('scan <url>')
    .description('Scan a URL for issues across Message, Experience, and Reach')
    .option('--wait', 'Wait for results (default: true)', true)
    .option('--critical-path', 'Scan up to 6 related pages (default)', true)
    .option('--single', 'Scan only the given URL')
    .option('--json', 'Output raw JSON')
    .action(async (url, opts) => {
    const config = loadConfig();
    if (!config.apiKey) {
        console.log(chalk.red('Not authenticated. Run: fixflags auth --api-key <key>'));
        process.exit(1);
    }
    const spinner = ora('Starting scan...').start();
    try {
        const createResult = (await callMcpTool('ff_check_url', {
            url,
            waitForCompletion: false,
            mode: opts.single ? 'single' : 'critical_path',
        }, config.apiKey));
        const reportId = createResult.reportId;
        if (!reportId) {
            spinner.fail('No reportId returned from ff_check_url');
            process.exit(1);
        }
        spinner.text = `Scan started (${reportId}). Waiting for results...`;
        if (!opts.wait) {
            spinner.succeed(`Scan started! Track at: ${createResult.reportUrl || `${API_BASE}/report/${reportId}`}`);
            return;
        }
        let status = createResult.status || 'QUEUED';
        while (status !== 'COMPLETED' && status !== 'FAILED') {
            await new Promise((r) => setTimeout(r, 3000));
            const statusResult = (await callMcpTool('ff_get_check_status', { reportId }, config.apiKey));
            status = statusResult.status;
            spinner.text = `Scan in progress... (${status})`;
        }
        if (status === 'FAILED') {
            spinner.fail('Scan failed.');
            process.exit(1);
        }
        spinner.succeed('Scan complete!');
        const report = (await callMcpTool('ff_get_report', { reportId }, config.apiKey));
        const rubrics = ['MESSAGE', 'EXPERIENCE', 'REACH'];
        const allFlags = [];
        for (const rubric of rubrics) {
            try {
                const rubricResult = (await callMcpTool('ff_get_rubric', { reportId, rubric }, config.apiKey));
                for (const f of rubricResult.flags || []) {
                    allFlags.push({ ...f, rubric });
                }
            }
            catch {
                // Rubric may be missing on degraded reports
            }
        }
        const payload = {
            reportId,
            reportUrl: `${API_BASE}/report/${reportId}`,
            score: report.score ?? null,
            verdict: report.verdict ?? null,
            rubrics: report.rubricDetails || [],
            flags: allFlags,
        };
        if (opts.json) {
            console.log(JSON.stringify(payload, null, 2));
        }
        else {
            console.log('');
            console.log(chalk.bold.cyan('FixFlags Report'));
            console.log(chalk.gray(`Report: ${payload.reportUrl}`));
            if (payload.score != null) {
                console.log(chalk.gray(`Score: ${payload.score}`));
            }
            console.log('');
            if (payload.rubrics.length > 0) {
                console.log(chalk.bold('Rubric Scores:'));
                for (const r of payload.rubrics) {
                    const color = RUBRIC_COLORS[r.name] || chalk.white;
                    const label = r.score !== null ? `${r.score}/100` : 'N/A';
                    console.log(`  ${color(`${r.name}: ${label}`)}`);
                }
                console.log('');
            }
            if (allFlags.length === 0) {
                console.log(chalk.green('No issues found. Looking good!'));
            }
            else {
                console.log(chalk.bold(`Found ${allFlags.length} issue(s):\n`));
                const byRubric = allFlags.reduce((acc, f) => {
                    ;
                    (acc[f.rubric] ||= []).push(f);
                    return acc;
                }, {});
                for (const [rubric, rubricFlags] of Object.entries(byRubric)) {
                    const color = RUBRIC_COLORS[rubric] || chalk.white;
                    console.log(color.bold(`  ${rubric} (${rubricFlags.length})`));
                    for (const flag of rubricFlags) {
                        console.log(formatFlag(flag));
                        console.log('');
                    }
                }
            }
            console.log(chalk.gray('Paste fix prompts into Cursor, Claude Code, Lovable, or Bolt.'));
            console.log(chalk.gray(`Re-check: fixflags scan ${url}`));
        }
        const hasCritical = allFlags.some((f) => f.severity === 'CRITICAL');
        if (hasCritical) {
            process.exit(1);
        }
    }
    catch (err) {
        spinner.fail(`Error: ${err.message}`);
        process.exit(1);
    }
});
program
    .command('status <reportId>')
    .description('Check the status of a scan')
    .action(async (reportId) => {
    const config = loadConfig();
    if (!config.apiKey) {
        console.log(chalk.red('Not authenticated. Run: fixflags auth --api-key <key>'));
        process.exit(1);
    }
    try {
        const result = (await callMcpTool('ff_get_check_status', { reportId }, config.apiKey));
        console.log(chalk.cyan(`Status: ${result.status}`));
        if (result.progress != null) {
            console.log(chalk.gray(`Progress: ${result.progress}%`));
        }
    }
    catch (err) {
        console.log(chalk.red(`Error: ${err.message}`));
        process.exit(1);
    }
});
program.parse();
