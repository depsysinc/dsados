import { DSRAMFileSystem } from "../src/dsFileSystem";
import { buildrootfs } from "../src/dsRootFS";
import { DSStream } from "../src/dsStream";
import { DSShell } from "../src/process/dssh";

function makedssh() {
    const stdin = new DSStream();
    const stdout = new DSStream();
    const fs = new DSRAMFileSystem();
    const dssh = new DSShell(
        2,
        1,
        fs.root,
        [],
        {},
        stdin,
        stdout
    );
    return dssh;
}

test('dssh exit', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write("exit");
    await expect(dsshpromise).resolves.toBeUndefined();
});

test('dssh End of Stream', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
});

test('dssh # comment', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('# comment');
    dssh.stdin.close()
    await expect(dsshpromise).resolves.toBeUndefined();
    // console.log(await dssh.stdout.read());
    expect(dssh.stdout.readsPending()).toEqual(0);
});

test('dssh "exit # comment"', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('exit # comment');
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.stdout.readsPending()).toEqual(0);
});

test('dssh testvar==testval', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar==testval');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    await expect(dssh.stdout.read()).resolves.toEqual("badly formed variable assignment\n");
});

test('dssh testvar=testval garbage', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar=testval garbage');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    await expect(dssh.stdout.read()).resolves.toEqual("badly formed variable assignment\n");
});

test('dssh testvar=testval', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar=testval');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["testvar"]).toEqual("testval");
});

test('dssh testvar="testval with spaces"', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar="testval with spaces"');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["testvar"]).toEqual("testval with spaces");
});

test('dssh $EMPTYVARIABLE', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('$EMPTYVARIABLE');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
});

test('dssh $TESTVAR', async () => {
    const dssh = makedssh();
    dssh.envp["TESTVAR"] = "bogus";
    const dsshpromise = dssh.start();
    dssh.stdin.write('$TESTVAR');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    await expect(dssh.stdout.read()).resolves.toEqual("bogus: command not found\n");
});

test('dssh $TESTVAR1$TESTVAR2', async () => {
    const dssh = makedssh();
    dssh.envp["TESTVAR1"] = "bad";
    dssh.envp["TESTVAR2"] = "command";
    const dsshpromise = dssh.start();
    dssh.stdin.write('$TESTVAR1$TESTVAR2');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    await expect(dssh.stdout.read()).resolves.toEqual("badcommand: command not found\n");
});

test('dssh TESTVAR3=" $TESTVAR1  $TESTVAR2 "', async () => {
    const dssh = makedssh();
    dssh.envp["TESTVAR1"] = "testvalue1";
    dssh.envp["TESTVAR2"] = "testvalue2";
    const dsshpromise = dssh.start();
    dssh.stdin.write('TESTVAR3=" $TESTVAR1  $TESTVAR2   "');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR3"]).toEqual(" testvalue1  testvalue2   ");
});

test('dssh TESTVAR=$', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('TESTVAR=$');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR"]).toEqual("$");
});

test('dssh TESTVAR="$"', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('TESTVAR="$"');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR"]).toEqual("$");
});

test('dssh TESTVAR=$$', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('TESTVAR=$$');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR"]).toEqual("$$");
});

test('dssh TESTVAR=$UNDEFVAR$', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('TESTVAR=$UNDEFVAR$');
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR"]).toEqual("$");
});

/*
test('', () => {

});
*/