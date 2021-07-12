import asyncHooks from 'async_hooks';
import Table from 'cli-table';
import { performance } from 'perf_hooks';
import stackTrace from 'stack-trace';
import stats from 'stats-lite';

let logs: { [key: string]: any } = {};
let rootDir: string = __dirname;
let profiler: asyncHooks.AsyncHook | null = null;

export function setRootDir(path: string) {
    rootDir = path;
}

export function clearProfilerData() {
    logs = {};
}

export function enableProfiler(rootDirectory: string) {
    rootDir = rootDirectory;
    if (profiler) return;
    clearProfilerData();
    profiler = asyncHooks
        .createHook({
            init: (asyncId, type, triggerAsyncId) => {
                const traces = stackTrace.parse(Error());
                const trace = traces.filter(
                    (t) => !t.getFileName()?.startsWith('internal/async_hooks')
                )[1];
                if (
                    !trace?.getFileName()?.startsWith(rootDir) ||
                    trace.getFileName().startsWith('node_modules/')
                ) {
                    return;
                }
                if (
                    trace.getLineNumber() === 1 &&
                    trace.getColumnNumber() === 1
                ) {
                    return;
                }
                logs[asyncId] = {
                    triggerAsyncId,
                    type,
                    position: `${trace.getFileName()}:${trace.getLineNumber()}:${trace.getColumnNumber()}`,
                    line: trace.getLineNumber(),
                    column: trace.getColumnNumber(),
                    path: trace.getFileName(),
                    name:
                        trace.getFunctionName() ||
                        trace.getMethodName() ||
                        '()',
                    init: performance.now(),
                };
            },
            before: (asyncId) => {
                const log = logs[asyncId];
                if (!log) return;
                log.before = performance.now();
            },
            promiseResolve(asyncId) {
                const log = logs[asyncId];
                if (!log) return;
                if (log.promiseResolve) return;
                log.promiseResolve = performance.now();
            },
        })
        .enable();
}

export function disableProfiler() {
    profiler?.disable();
    profiler = null;
}

interface Result {
    key: string;
    sum: number;
    mean: number;
    count: number;
    p95: number;
    p99: number;
    position: string;
    path: string;
    line: number;
    column: number;
    name: string;
}

interface ResultOption {
    order?: keyof Result;
    limit?: number;
    newRootDir?: string;
}

export function getProfilerResult({
    order = 'sum',
    limit = 1000,
    newRootDir,
}: ResultOption = {}) {
    const durations: { [key: string]: number[] } = {};
    const info: {
        [key: string]: {
            position: string;
            name: string;
            path: string;
            line: number;
            column: number;
        };
    } = {};
    for (const asyncId of Object.keys(logs)) {
        const log = logs[asyncId];
        const key = `${log.position} in ${log.name}`;
        const endTime = log.promiseResolve || log.before;
        if (!endTime) continue;
        if (!durations[key]) durations[key] = [];
        durations[key].push(endTime - log.init);
        info[key] = {
            position: newRootDir
                ? log.position.replace(rootDir, newRootDir)
                : log.position,
            name: log.name,
            path: newRootDir ? log.path.replace(rootDir, newRootDir) : log.path,
            line: log.line,
            column: log.column,
        };
    }
    const result: Result[] = [];
    for (const key of Object.keys(durations).sort()) {
        const durationList = durations[key];
        result.push({
            ...info[key],
            key: newRootDir ? key.replace(rootDir, newRootDir) : key,
            sum: Math.floor(stats.sum(durationList)),
            mean: Math.floor(stats.mean(durationList)),
            count: durationList.length,
            p95: Math.floor(stats.percentile(durationList, 0.95)),
            p99: Math.floor(stats.percentile(durationList, 0.99)),
        });
    }
    if (order) {
        result.sort((a, b) =>
            a[order] > b[order] ? -1 : a[order] === b[order] ? 0 : 1
        );
    }
    return result.slice(0, limit);
}

export function getResultTable(option: ResultOption = {}) {
    const result = getProfilerResult(option);
    const head = ['position', 'name', 'sum', 'count', 'mean', 'p95', 'p99'];
    const table = new Table({
        head,
        style: {
            head: ['red'],
            border: ['grey'],
        },
    });
    table.push(...result.map((line) => head.map((item) => line[item])));
    return table.toString();
}

const COLORS = [
    '#777',
    '#BBB',
    '#F7FD04',
    '#F9B208',
    '#F98404',
    '#FC5404',
    '#F33',
];
function getAnnotationColor(num: number, borders: number[]) {
    for (let i = 0; i < borders.length; i++) {
        if (num < borders[i]) return COLORS[i];
    }
    return COLORS[borders.length];
}

export function getResultForAnnotation(option: ResultOption = {}) {
    const result = getProfilerResult(option);
    const sums = result.map(({ sum }) => sum);
    const borders = [0.3, 0.5, 0.8, 0.9, 0.95, 0.99].map((th) =>
        stats.percentile(sums, th)
    );

    return JSON.stringify(
        result.map((line) => ({
            path: line.path,
            line: line.line,
            text: ` ${line.sum}ms - (count:${line.count} mean:${line.mean}ms p99:${line.p99}ms) `,
            hoverMessage: `${JSON.stringify(line, null, 2)}`,
            color: getAnnotationColor(line.sum, borders),
            backgroundColor:
                getAnnotationColor(line.sum, borders) !== COLORS[0]
                    ? '#444'
                    : undefined,
        }))
    );
}
