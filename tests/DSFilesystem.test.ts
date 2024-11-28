import { DSFilesystem, DSFileInfo, DSIDirectoryAlreadyExistsError, DSIDirectory } from "../src/dsFilesystem"

function createTestFS(): DSFilesystem {
    return new DSFilesystem();
}

test('fs empty', () => {
    const fs = new DSFilesystem();
    expect(fs.root.filelist).toBeDefined();
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
    const fs = new DSFilesystem();
    const root = fs.root;

    const nodir = root.getfileinfo("testdir");
    expect(nodir).not.toBeDefined();

    expect(root.mkdir("testdir")).toBeInstanceOf(DSIDirectory);

    const dir = root.getfileinfo("testdir");
    expect(dir).toBeDefined();
    expect(dir?.name).toEqual("testdir");
});

test('mkdir with name collision', () => {
    const fs = new DSFilesystem();
    const root = fs.root;
    root.mkdir('samename');
    expect(() => root.mkdir('samename')).toThrow(
        new DSIDirectoryAlreadyExistsError("samename")
    );
});

// paths

test('path empty fs', () => {
    const fs = new DSFilesystem();
    const path = fs.root.path;
    expect(path).toEqual("/");
});

test('path 3 levels', () => {
    const fs = new DSFilesystem();
    const dirA = fs.root.mkdir("dirA");
    const dirB = dirA.mkdir("dirB");
    const dirC = dirB.mkdir("dirC");
    expect(dirC.path).toEqual("/dirA/dirB/dirC/");
});

/*
test('', () => {

});
*/