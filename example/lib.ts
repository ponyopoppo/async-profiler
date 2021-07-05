const sleep = async (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

class A {
    async hoge() {
        await sleep(100);
    }

    fuga() {}
}

const a = new A();

export async function main() {
    await sleep(50);
    await a.hoge();
    await (async () => {
        await sleep(100);
    })();
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
        .then(async () => {
            await sleep(10);
        })
        .then(async () => await sleep(100))
        .then(() => sleep(100))
        .then(() => {});
    a.fuga();
}
