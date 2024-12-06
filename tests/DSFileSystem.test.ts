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
    DSIFileAlreadyExistsError 
} from "../src/dsFileSystem"
import {DSIStaticWebFile} from "../src/filesystem/dsIStaticWebFile"


const webtest = (process.env.RUN_WEB_TESTS === "true") ? test : test.skip;

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

// TODO files 
//      TESTS check that you can't name 2 files the same thing
//          for create
//          for rename

// TESTS mkdir

test('mkdir', () => {
    const fs = new DSFileSystem();
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
    const fs = new DSFileSystem();
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
    const fs = new DSFileSystem();
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
    const fs = new DSFileSystem();
    const path = fs.root.path;
    expect(path).toEqual("/");
});

test('path 3 levels', () => {
    const fs = new DSFileSystem();
    fs.root.chmod(DSFilePerms.full());

    const dirA = fs.root.mkdir("dirA");
    const dirB = dirA.mkdir("dirB");
    const dirC = dirB.mkdir("dirC");
    expect(dirC.path).toEqual("/dirA/dirB/dirC");
});

// TESTS getdir path traversal

// TODO Test that you can't change dirs to a file

test('getdir <bad path>', () => {
    const fs = new DSFileSystem();

    expect(() =>
        fs.root.getdir('')
    ).toThrow(
        new DSIDirectoryInvalidPathError("")
    );
});

test('getdir <non existent path>', () => {
    const fs = new DSFileSystem();
    expect(() =>
        fs.root.getdir('florb')
    ).toThrow(
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

test('DSIStaticWebFile.filetype badurl', async () => {
    const fs = new DSFileSystem();
    const badurlfile = new DSIStaticWebFile(fs, "thisisabadurl");
    const filetype = await badurlfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIStaticWebFile.filetype badhostname', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "http://test.invalid/");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIStaticWebFile.filetype cantconnect', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "http://localhost:37654/");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

webtest('DSIStaticWebFile.filetype 404', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "https://httpstat.us/404");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

test('DSIStaticWebFile.filetype file://', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "file://thing");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("null");
});

webtest('DSIStaticWebFile.filetype http://example.com', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "http://example.com");
    const filetype = await newfile.filetype();
    expect(filetype).not.toEqual("null");
});

webtest('DSIStaticWebFile.filetype testpng', async () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs,
        "http://www.libpng.org/pub/png/colorcube/pngs-nogamma/ffffff.png");
    const filetype = await newfile.filetype();
    expect(filetype).toEqual("image/png");
});

// addfile tests

test('addfile illegaldirectory', () => {
    const fs = new DSFileSystem();
    const filename = "illegaldirectory";
    expect(() =>
        fs.root.addfile(filename, new DSIDirectory(fs, DSFilePerms.full()))
    ).toThrow(
        new DSIDirectoryIllegalAddfileError("file is directory")
    )
});

test('addfile differentfs', () => {
    const fs_a = new DSFileSystem();
    const fs_b = new DSFileSystem();
    const filename = "differentfs";
    expect(() =>
        fs_a.root.addfile(filename, new DSIStaticWebFile(fs_b, ""))
    ).toThrow(
        new DSIDirectoryIllegalAddfileError("filesystem mismatch")
    )
});

test('addfile testfile', () => {
    const fs = new DSFileSystem();
    const newfile = new DSIStaticWebFile(fs, "");
    fs.root.addfile('testfile', newfile);
    expect(fs.root.getfileinfo('testfile')?.inode).toEqual(newfile);
});

test('addfile duplicate', () => {
    const fs = new DSFileSystem();
    fs.root.addfile('testfile', new DSIStaticWebFile(fs, ""));
    expect(() =>
        fs.root.addfile('testfile', new DSIStaticWebFile(fs, ""))
    ).toThrow(
        new DSIFileAlreadyExistsError('testfile')
    )
});

test('addfile collisionwithdir', () => {
    const fs = createTestFS();
    expect(() =>
        fs.root.addfile('gamma', new DSIStaticWebFile(fs, ""))
    ).toThrow(
        new DSIFileAlreadyExistsError('gamma')
    )
});

// StaticWebFile tests

test('chmod staticwebfile', () => {
    const fs = new DSFileSystem();
    const newfile = fs.root.addfile("staticwebfile", new DSIStaticWebFile(fs, ""))
    const badperms = DSFilePerms.full();
    expect(() =>
        newfile.chmod(badperms)
    ).toThrow(
        new DSFilePermsUnsupportedError(badperms.permString())
    )
});

test('contentAsText noreadperms', async () => {
    const fs = new DSFileSystem();
    const newfile = fs.root.addfile("staticwebfile", new DSIStaticWebFile(fs, ""))
    newfile.chmod(DSFilePerms.none());

    expect(newfile.contentAsText()).rejects.toThrow(
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