import { DSFilePerms, DSFilePermsReadError } from "../src/dsFileSystem";
import { DSStream, DSStreamClosedError } from "../src/dsStream";
import { DSIWebFile } from "../src/filesystem/dsIWebFile";
import { DSRAMFileSystem } from "../src/filesystem/dsRAMFileSystem";

const webtest = (process.env.RUN_WEB_TESTS === "true") ? test : test.skip;
const demofilelink =  'https://www.gutenberg.org/files/9542/old/7poet10.txt'
const demoimagelink = 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Image_created_with_a_mobile_phone.png'

webtest('filetype png', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, demoimagelink);
    await expect(testfile.filetype()).resolves.toEqual('image/png');

});

webtest('filetype txt', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, demofilelink);
    await expect(testfile.filetype()).resolves.toEqual('text/plain');

});

test('filetype null', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, 'a/nonexistent/file');
    await expect(testfile.filetype()).resolves.toEqual('null');
    
});

webtest('invalid https link', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, 'https://aisflisahflaksjhflksahflksa.com');
    await expect(testfile.filetype()).resolves.toEqual('null');
    expect(testfile.lasterror).not.toBe(undefined);

})

webtest('contentAsText txt', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, demofilelink);
    const outstream = testfile.contentAsText();
    expect(outstream.closed).toEqual(false);
    await expect(outstream.read()).resolves.not.toBe(undefined);
});

test('contentAsText null', async () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, 'a/invalid/path');
    const outstream = testfile.contentAsText();
    await expect(outstream.read()).rejects.toThrow(DSStreamClosedError);
})

webtest('chmod reading disabled', () => {
    const fs = new DSRAMFileSystem();
    const testfile = new DSIWebFile(fs, demofilelink);

    testfile.chmod(new DSFilePerms(false, false, false));
    expect(() => testfile.contentAsText()).toThrow(DSFilePermsReadError);

})




/*
 
test('', () => {

});
*/