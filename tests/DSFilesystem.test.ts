import { DSFileSystem, DSIDirectoryAlreadyExistsError, DSIDirectory, DSIDirectoryInvalidPathError, DSFilePerms, DSFilePermsReadError, DSFilePermsExecError } from "../src/dsFilesystem"

test('fs empty', () => {
    const fs = new DSFileSystem();
    // Check .
    const curdirfromstring = fs.root.getfileinfo(".");
    expect(curdirfromstring).toBeDefined();
    expect(curdirfromstring?.inode).toEqual(fs.root);

    const curdirfrominode = fs.root.getfileinfo(curdirfromstring?.inode!);
    expect(curdirfromstring).toEqual(curdirfromstring);

    // Check ..
    const parentdirfromstring = fs.root.getfileinfo("..");
    expect(parentdirfromstring).toBeDefined();
    expect(parentdirfromstring?.inode).toEqual(fs.root);

});

// TEST check that you can't name 2 files the same thing
//      for create
//      for rename

// mkdir

test('mkdir', () => {
    const fs = new DSFileSystem();
    const root = fs.root;

    const nodir = root.getfileinfo("testdir");
    expect(nodir).not.toBeDefined();

    expect(root.mkdir("testdir")).toBeInstanceOf(DSIDirectory);

    const dir = root.getfileinfo("testdir");
    expect(dir).toBeDefined();
    expect(dir?.name).toEqual("testdir");
});

test('mkdir with name collision', () => {
    const fs = new DSFileSystem();
    const root = fs.root;
    root.mkdir('samename');
    expect(() => root.mkdir('samename')).toThrow(
        new DSIDirectoryAlreadyExistsError("samename")
    );
});

// paths

test('path empty fs', () => {
    const fs = new DSFileSystem();
    const path = fs.root.path;
    expect(path).toEqual("/");
});

test('path 3 levels', () => {
    const fs = new DSFileSystem();
    const dirA = fs.root.mkdir("dirA");
    const dirB = dirA.mkdir("dirB");
    const dirC = dirB.mkdir("dirC");
    expect(dirC.path).toEqual("/dirA/dirB/dirC");
});

// path traversal

// Test that you can't change dirs to a file

test('getdir <bad path>', () => {
    const fs = new DSFileSystem();

    expect(() => fs.root.getdir('')).toThrow(
        new DSIDirectoryInvalidPathError("")
    );
});

test('getdir <non existent path>', () => {
    const fs = new DSFileSystem();
    expect(() => fs.root.getdir('florb')).toThrow(
        new DSIDirectoryInvalidPathError("florb")
    );
});

test('getdir . from /', () => {
    const fs = new DSFileSystem();

    expect(fs.root.getdir('.')).toEqual(fs.root);
});

test('getdir .. from /', () => {
    const fs = new DSFileSystem();

    expect(fs.root.getdir('..')).toEqual(fs.root);
});

test('getdir / from /', () => {
    const fs = new DSFileSystem();

    expect(fs.root.getdir('/')).toEqual(fs.root);
});

/*
/
|-- alpha
    |-- foo
    |-- bar
|-- gamma
    |-- deep
        |-- tree
            |-- branch
*/
function createTestFS(): DSFileSystem {
    const fs = new DSFileSystem();

    const alpha = fs.root.mkdir("alpha");
    const foo = alpha.mkdir("foo");
    const bar = alpha.mkdir("bar");

    const gamma = fs.root.mkdir("gamma");
    const deep = gamma.mkdir("deep");
    const tree = deep.mkdir("tree");
    const branch = tree.mkdir("branch");

    return fs;
}

test('getdir /gamma/deep/tree/branch from /', () => {
    const fs = createTestFS();

    const branch = fs.root.getdir("/gamma/deep/tree/branch");
    expect(branch.path).toEqual("/gamma/deep/tree/branch");
});

test('getdir / from subdir', () => {
    const fs = createTestFS();
    const branch = fs.root.getdir("/gamma/deep/tree/branch");
    const root = branch.getdir("/");
    expect(root).toEqual(fs.root);
});

test('getdir ../../.. from /gamma/deep/tree/branch', () => {
    const fs = createTestFS();
    const branch = fs.root.getdir("/gamma/deep/tree/branch");
    const gamma = branch.getdir("../../..");
    expect(gamma).toEqual(fs.root.getdir("gamma"));
});

test('getdir ../../../../alpha/foo from /gamma/deep/tree/branch', () => {
    const fs = createTestFS();
    const branch = fs.root.getdir("/gamma/deep/tree/branch");
    const foo = branch.getdir("../../../../alpha/foo");
    expect(foo).toEqual(fs.root.getdir("/alpha/foo"));
});

test('chmod -rwx', () =>{
    const fs = createTestFS();
    const branch = fs.root.getdir("/gamma/");
    expect (branch.perms).toEqual(DSFilePerms.full());

    branch.chmod(DSFilePerms.none());
    expect (branch.perms).toEqual(DSFilePerms.none());
});

test('chmod -r /gamma ls', () => {
    const fs = createTestFS();
    const gamma = fs.root.getdir("/gamma/");
    gamma.chmod(new DSFilePerms(false, true ,true));

    expect(() => gamma.filelist).toThrow(new DSFilePermsReadError("gamma"));
})

/*
test('chmod -x /gamma getdir /gamma/deep', () => {
    const fs = createTestFS();
    const gamma = fs.root.getdir("/gamma/");
    gamma.fileinfo.chmod(new DSFilePerms(true, true ,false));

    expect(() => fs.root.getdir("/gamma/deep")).toThrow(new DSFilePermsExecError("gamma"));
});


test('', () => {

});
*/