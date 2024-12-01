import { DSProcess } from "../src/dsProcess";
import { DSFilePerms, DSFileSystem, DSIDirectory } from "../src/dsFilesystem";

// Tests to make sure pushing and popping of procstack works
class TestProcess extends DSProcess {
    constructor(pwd: DSIDirectory) {

        super(0,0,pwd);
    }
    get procname(): string {
        return "TestFSProcess";
    }
    protected main(): void {
        throw new Error("Should never be called!");
    }
    
}

function createTestFS(): DSFileSystem {
    const fs = new DSFileSystem();
    fs.root.chmod(DSFilePerms.full());

    const alpha = fs.root.mkdir("alpha");
    const foo = alpha.mkdir("foo");
    const bar = alpha.mkdir("bar");

    const gamma = fs.root.mkdir("gamma");
    const deep = gamma.mkdir("deep");
    const tree = deep.mkdir("tree");
    const branch = tree.mkdir("branch");
    return fs;
}

// File tests

test('chdir .', () => {
    const fs = createTestFS();
    const tp = new TestProcess(fs.root);

    expect(tp.cwd).toEqual(fs.root);
    tp.chdir('.');
    expect(tp.cwd).toEqual(fs.root);
});


/*
test('', () => {

});
*/