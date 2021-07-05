import assert from 'assert';
import {
    enableProfiler,
    disableProfiler,
    getProfilerResult,
    getResultTable,
} from '../src/index';

const sleep = async (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('async-profiler', () => {
    beforeEach(() => {
        disableProfiler();
        enableProfiler(__dirname);
    });

    it('should get result correctly', async () => {
        const func = async () => {
            await sleep(200);
            await sleep(300);
        };
        await func();

        const result = getProfilerResult();

        assert.strictEqual(result.length, 5);
        console.log(getResultTable());
    });

    it('should get result correctly 2', async () => {
        const func = async () => {
            return new Promise<void>((resolve) => setTimeout(resolve, 1000))
                .then(async () => {
                    await sleep(10);
                    return 3;
                })
                .then(async () => sleep(100))
                .then(async (num) => {
                    await sleep(80);
                });
        };
        await func();

        const result = getProfilerResult();

        assert.strictEqual(result.length, 8);
        console.log(getResultTable());
    });
});
