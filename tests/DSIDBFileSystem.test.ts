import 'fake-indexeddb/auto';

import { DSIDBFileSystem } from "../src/filesystem/dsIDBFileSystem";
import { DSFilePerms } from '../src/dsFileSystem';

function getRandDBName(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // Letters only (you can add more characters if needed)
    let result = 'testdb_';
    for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters[randomIndex];
    }
    return result;
}

test('DSIDBFS open', async () => {
    const dbname = getRandDBName();
    const fs = new DSIDBFileSystem(dbname, 1);
    await fs.open();

    expect(fs.root).toBeDefined();

    const fs2 = new DSIDBFileSystem(dbname, 1);
    await fs2.open();

    expect(fs2.root).toBeDefined();
});

test('DSIDBFS changed chmod', async () => {
    const dbname = getRandDBName();
    const fs = new DSIDBFileSystem(dbname, 1);
    await fs.open();

    expect(fs.root.perms).toEqual(DSFilePerms.full());
    fs.root.chmod(DSFilePerms.rx());
    expect(fs.root.perms).toEqual(DSFilePerms.rx());

    const fs2 = new DSIDBFileSystem(dbname, 1);
    await fs2.open();
    expect(fs2.root.perms).toEqual(DSFilePerms.rx());
});

test('DSIDBFS changed mkdir', async () => {
    const dbname = getRandDBName();
    const fs = new DSIDBFileSystem(dbname, 1);
    await fs.open();

    // Add a directory structure
    const alpha = fs.root.mkdir("alpha", DSFilePerms.full());
    const uno = alpha.mkdir("uno", DSFilePerms.full());
    const due = alpha.mkdir("due", DSFilePerms.readonly());
    const deep = fs.root.mkdir("deep", DSFilePerms.full());
    const branch = deep.mkdir("branch", DSFilePerms.full());
    const leaf = branch.mkdir("leaf", DSFilePerms.execonly());

    const fs2 = new DSIDBFileSystem(dbname, 1);
    await fs2.open();

    expect(fs2.root.getdir("/alpha")).toBeDefined();
    expect(fs2.root.getdir("/alpha/uno")).toBeDefined();
    expect(fs2.root.getdir("/alpha/uno").perms).toEqual(DSFilePerms.full());
    expect(fs2.root.getdir("/alpha/due")).toBeDefined();
    expect(fs2.root.getdir("/alpha/due").perms).toEqual(DSFilePerms.readonly());
    expect(fs2.root.getdir("/deep/branch/leaf")).toBeDefined();
    expect(fs2.root.getdir("/deep/branch/leaf").perms).toEqual(DSFilePerms.execonly());
});