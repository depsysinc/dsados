import {
    DSFileSystem,
    DSIDirectoryAlreadyExistsError,
    DSIDirectory,
    DSIDirectoryInvalidPathError,
    DSFilePerms,
    DSFilePermsReadError,
    DSFilePermsExecError,
    DSIDirectoryIllegalFilenameError,
    DSFilePermsWriteError,
    DSFileSystemReadonlyError,
    DSIDirectoryIllegalAddfileError,
    DSFilePermsUnsupportedError,
    DSIFileAlreadyExistsError,
    DSRAMFileSystem
} from "../src/dsFileSystem"
import { DSIWebFile } from "../src/filesystem/dsIWebFile"


const webtest = (process.env.RUN_WEB_TESTS === "true") ? test : test.skip;

test('fs empty', () => {
    const fs = new DSRAMFileSystem();
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

// TODO files 
//      TESTS check that you can't name 2 files the same thing
//          for create
//          for rename

// TESTS mkdir

test('mkdir', () => {
    const fs = new DSRAMFileSystem();
    const root = fs.root;
    root.chmod(DSFilePerms.full());

    const nodir = root.getfileinfo("testdir");
    expect(nodir).not.toBeDefined();

    expect(root.mkdir("testdir")).toBeInstanceOf(DSIDirectory);

    const dir = root.getfileinfo("testdir");
    expect(dir).toBeDefined();
    expect(dir?.name).toEqual("testdir");
});

test('mkdir with name collision', () => {
    const fs = new DSRAMFileSystem();
    const root = fs.root;
    root.chmod(DSFilePerms.full());

    root.mkdir('samename');
    expect(() =>
        root.mkdir('samename')
    ).toThrow(
        new DSIDirectoryAlreadyExistsError("samename")
    );
});

test('mkdir with illegal character', () => {
    const fs = new DSRAMFileSystem();
    const root = fs.root;
    root.chmod(DSFilePerms.full());

    const badfilename = `bad/name`;

    expect(() =>
        root.mkdir(badfilename)
    ).toThrow(
        new DSIDirectoryIllegalFilenameError(badfilename)
    );
});

// TESTS paths

test('path empty fs', () => {
    const fs = new DSRAMFileSystem();
    const path = fs.root.path;
    expect(path).toEqual("/");
});

test('path 3 levels', () => {
    const fs = new DSRAMFileSystem();
    fs.root.chmod(DSFilePerms.full());

    const dirA = fs.root.mkdir("dirA");
    const dirB = dirA.mkdir("dirB");
    const dirC = dirB.mkdir("dirC");
    expect(dirC.path).toEqual("/dirA/dirB/dirC");
});

// TESTS getdir path traversal

// TODO Test that you can't change dirs to a file

test('getdir <bad path>', () => {
    const fs = new DSRAMFileSystem();

    expect(() =>
        fs.root.getdir('')
    ).toThrow(
        new DSIDirectoryInvalidPathError("")
    );
});

test('getdir <non existent path>', () => {
    const fs = new DSRAMFileSystem();
    expect(() =>
        fs.root.getdir('florb')
    ).toThrow(
        new DSIDirectoryInvalidPathError("florb")
    );
});

test('getdir . from /', () => {
    const fs = new DSRAMFileSystem();

    expect(fs.root.getdir('.')).toEqual(fs.root);
});

test('getdir .. from /', () => {
    const fs = new DSRAMFileSystem();

    expect(fs.root.getdir('..')).toEqual(fs.root);
});

test('getdir / from /', () => {
    const fs = new DSRAMFileSystem();

    expect(fs.root.getdir('/')).toEqual(fs.root);
});

/*
/
|-- testfile1.txt
|-- alpha
    |-- foo
    |-- bar
|-- gamma
    |-- deep
        |-- tree
            |-- branch
            |-- testfile2.txt
*/
function createTestFS(): DSRAMFileSystem {
    const fs = new DSRAMFileSystem();
    fs.root.chmod(DSFilePerms.full());

    const testfile1 = fs.root.addfile("testfile1.txt", new DSIWebFile(fs, ""));

    const alpha = fs.root.mkdir("alpha");
    const foo = alpha.mkdir("foo");
    const bar = alpha.mkdir("bar");

    const gamma = fs.root.mkdir("gamma");
    const deep = gamma.mkdir("deep");
    const tree = deep.mkdir("tree");
    const branch = tree.mkdir("branch");

    const testfile2 = branch.addfile("testfile2.txt", new DSIWebFile(fs, ""));

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

test('getdir /gamma/deep/tree/branch from /alpha', () => {
    const fs = createTestFS();
    const alpha = fs.root.getdir("/alpha");
    const branch = alpha.getdir("/gamma/deep/tree/branch");
    const branchfromroot = fs.root.getdir("/gamma/deep/tree/branch");
    expect(branch).toEqual(branchfromroot);
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

// Getfile tests

test('getfile nosuchfile', () => {
    const fs = createTestFS();
    expect(() => fs.root.getfile("nosuchfile")).toThrow(
        new DSIDirectoryInvalidPathError("nosuchfile")
    );
});

test('getfile testfile1.txt', () => {
    const fs = createTestFS();
    const testfile1info = fs.root.getfileinfo("testfile1.txt");
    expect(fs.root.getfile("testfile1.txt")).toEqual(testfile1info?.inode);
});

test('getfile /testfile1.txt', () => {
    const fs = createTestFS();
    const testfile1info = fs.root.getfileinfo("testfile1.txt");
    expect(fs.root.getfile("/testfile1.txt")).toEqual(testfile1info?.inode);
});

test('getfile /gamma/deep/tree/branch/testfile2.txt', () => {
    const fs = createTestFS();
    const path = "/gamma/deep/tree/branch/testfile2.txt";
    const testfile2info = fs.root.getdir("/gamma/deep/tree/branch").getfileinfo("testfile2.txt");
    expect(fs.root.getfile(path)).toEqual(testfile2info?.inode);
});

test('getfile gamma/', () => {
    const fs = createTestFS();
    const path = "/gamma/";
    expect(() => fs.root.getfile(path)).toThrow(
        new DSIDirectoryInvalidPathError(path)
    );
});

test("getfile /gamma/bogus/path/file.txt", () => {
    const fs = createTestFS();
    const path = "/gamma/bogus/path/file.txt";
    expect(() => fs.root.getfile(path)).toThrow(
        // NB: nested getdir only returns dir portion in exception
        new DSIDirectoryInvalidPathError("/gamma/bogus/path")
    );
});

test('getfile /gamma/deep/tree', () => {
    const fs = createTestFS();
    const path = "/gamma/deep/tree";
    const treedirinfo = fs.root.getdir("/gamma/deep/").getfileinfo("tree");
    expect(fs.root.getfile(path)).toEqual(treedirinfo?.inode);
});

test('getfile /gamma/deep/tree/bogusfile.txt', () => {
    const fs = createTestFS();
    const path = "/gamma/deep/tree/bogusfile.txt";
    expect(() => fs.root.getfile(path)).toThrow(
        new DSIDirectoryInvalidPathError(path)
    );
});

test('getfile /gamma/deep/tree/branch/testfile2.txt from /alpha', () => {
    const fs = createTestFS();
    const path = "/gamma/deep/tree/branch/testfile2.txt";
    const testfile2info = fs.root.getdir("/gamma/deep/tree/branch").getfileinfo("testfile2.txt");
    const fromdir = fs.root.getdir("/alpha");
    expect(fromdir.getfile(path)).toEqual(testfile2info?.inode);
});

// chmod tests

test('chmod -rwx', () => {
    const fs = createTestFS();
    const branch = fs.root.getdir("/gamma/");
    expect(branch.perms).toEqual(DSFilePerms.full());

    branch.chmod(DSFilePerms.none());
    expect(branch.perms).toEqual(DSFilePerms.none());
});


test('chmod -r /gamma; ls', () => {
    const fs = createTestFS();
    const gamma = fs.root.getdir("/gamma/");
    gamma.chmod(new DSFilePerms(false, true, true));

    expect(() =>
        gamma.filelist
    ).toThrow(
        new DSFilePermsReadError()
    );
})

test('chmod -x /gamma getdir /gamma/deep', () => {
    const fs = createTestFS();
    const gamma = fs.root.getdir("/gamma/");
    gamma.chmod(new DSFilePerms(true, true, false));

    expect(() =>
        fs.root.getdir("/gamma/deep")
    ).toThrow(
        new DSFilePermsExecError()
    );
});

test('chmod -w /gamma; mkdir dirdenied from /gamma', () => {
    const fs = createTestFS();

    const gamma = fs.root.getdir("/gamma/");
    gamma.chmod(DSFilePerms.rx());

    const dirdenied = "dirdenied";
    expect(() =>
        gamma.mkdir(dirdenied)
    ).toThrow(
        new DSFilePermsWriteError()
    );

});

// Readonly filesystem

test('mkdir readonlyfs', () => {
    const fs = createTestFS();
    fs.readonly = true;
    expect(() =>
        fs.root.mkdir("readonlyfs")
    ).toThrow(
        new DSFileSystemReadonlyError('mkdir')
    )
});

test('chmod readonlyfs', () => {
    const fs = createTestFS();
    fs.readonly = true;

    const gamma = fs.root.getdir("/gamma/");

    expect(() =>
        gamma.chmod(DSFilePerms.full())
    ).toThrow(
        new DSFileSystemReadonlyError('chmod')
    )
});

// filetype tests

test('filetype gamma', async () => {
    const fs = createTestFS();
    const filetype = await fs.root.filetype();
    expect(filetype).toEqual("directory");
});

// staticwebfile tests

test('DSIWebFile.filetype badurl', async () => {
    const fs = new DSRAMFileSystem();
    const badurlfile = new DSIWebFile(fs, "thisisabadurl");
    const filetype = await badurlfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIWebFile.filetype badhostname', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "http://test.invalid/");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIWebFile.filetype cantconnect', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "http://localhost:37654/");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

webtest('DSIWebFile.filetype 404', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "https://httpstat.us/404");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIWebFile.filetype file://', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "file://thing");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

webtest('DSIWebFile.filetype http://example.com', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "http://example.com");
    const filetype = await newfile.filetype();
    expect(filetype).not.toEqual("null");
});

webtest('DSIWebFile.filetype testpng', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs,
        "http://www.libpng.org/pub/png/colorcube/pngs-nogamma/ffffff.png");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("image/png");
});

// addfile tests

test('addfile illegaldirectory', () => {
    const fs = new DSRAMFileSystem();
    const filename = "illegaldirectory";
    expect(() =>
        fs.root.addfile(filename, new DSIDirectory(fs, DSFilePerms.full()))
    ).toThrow(
        new DSIDirectoryIllegalAddfileError("file is directory")
    )
});

test('addfile differentfs', () => {
    const fs_a = new DSRAMFileSystem();
    const fs_b = new DSRAMFileSystem();
    const filename = "differentfs";
    expect(() =>
        fs_a.root.addfile(filename, new DSIWebFile(fs_b, ""))
    ).toThrow(
        new DSIDirectoryIllegalAddfileError("filesystem mismatch")
    )
});

test('addfile testfile', () => {
    const fs = new DSRAMFileSystem();
    const newfile = new DSIWebFile(fs, "");
    fs.root.addfile('testfile', newfile);
    expect(fs.root.getfileinfo('testfile')?.inode).toEqual(newfile);
});

test('addfile duplicate', () => {
    const fs = new DSRAMFileSystem();
    fs.root.addfile('testfile', new DSIWebFile(fs, ""));
    expect(() =>
        fs.root.addfile('testfile', new DSIWebFile(fs, ""))
    ).toThrow(
        new DSIFileAlreadyExistsError('testfile')
    )
});

test('addfile collisionwithdir', () => {
    const fs = createTestFS();
    expect(() =>
        fs.root.addfile('gamma', new DSIWebFile(fs, ""))
    ).toThrow(
        new DSIFileAlreadyExistsError('gamma')
    )
});

// StaticWebFile tests

test('chmod staticwebfile', () => {
    const fs = new DSRAMFileSystem();
    const newfile = fs.root.addfile("staticwebfile", new DSIWebFile(fs, ""))
    const badperms = DSFilePerms.full();
    expect(() =>
        newfile.chmod(badperms)
    ).toThrow(
        new DSFilePermsUnsupportedError(badperms.permString())
    )
});

test('contentAsText noreadperms', async () => {
    const fs = new DSRAMFileSystem();
    const newfile = fs.root.addfile("staticwebfile", new DSIWebFile(fs, ""))
    newfile.chmod(DSFilePerms.none());

    expect(() =>
        newfile.contentAsText()
    ).toThrow(
        new DSFilePermsReadError()
    )
});


/*
 
test('', () => {

});

expect(() => 

).toThrow(

)

*/