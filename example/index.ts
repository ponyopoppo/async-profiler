import fs from 'fs';
import { enableProfiler, getResultForAnnotation, getResultTable } from '../src';
import { main } from './lib';

enableProfiler(__dirname);
main().then(async () => {
    await main();
    console.log(getResultTable());
    fs.writeFileSync('annotations', getResultForAnnotation());
});
