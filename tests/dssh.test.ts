import { DSFilePerms, DSIDirectory, DSInode, DSRAMFileSystem } from "../src/dsFileSystem";
import { DSKernel } from "../src/dsKernel";
import { DSProcess } from "../src/dsProcess";
import { DSStream } from "../src/dsStream";
import { DSIProcessFile } from "../src/filesystem/dsIProcessFile";
import { DSIStaticTextFile } from "../src/filesystem/dsIStaticFile";
import { DSShell, DSShellError } from "../src/process/dssh";
import { PREcho } from "../src/process/echo";

class TestProcess extends DSProcess {
    constructor(pwd: DSIDirectory) {
        super(0, 0, pwd, [], {}, new DSStream(), new DSStream());
    }
    get procname(): string {
        return "TestProcess";
    }
    protected async main(): Promise<void> {
        return;
    }

}

function resetKernel() {
    DSKernel.fstable = [];
    DSKernel.procstack = [];
    DSKernel.nextpid = 1;

    const fs = new DSRAMFileSystem();
    DSKernel.mount('/', fs);

    const init = new TestProcess(fs.root);
    DSKernel.procstack.push(init);

    const bindir = fs.root.mkdir("bin",DSFilePerms.full());
    let binfile: DSInode = new DSIProcessFile(DSKernel.rootfs, DSShell);
    bindir.addfile("dssh", binfile);

    binfile = new DSIProcessFile(DSKernel.rootfs, PREcho);
    bindir.addfile("echo", binfile);

    const subdir = bindir.mkdir("subdir",DSFilePerms.rx())

    bindir.chmod(DSFilePerms.rx())
    return init;
}


function makedssh() {
    const stdin = new DSStream();
    const stdout = new DSStream();

    const fs = new DSRAMFileSystem();
    const bindir = fs.root.mkdir('bin');
    let binfile: DSInode;

    binfile = new DSIProcessFile(fs, PREcho);
    bindir.addfile("echo", binfile);

    bindir.mkdir("subdir")

    const dssh = new DSShell(
        2,
        1,
        fs.root,
        ['dssh'],
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

// VARIABLE ASSIGNMENT

test('dssh testvar==testval', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar==testval');
    dssh.stdin.close();
    await expect(dsshpromise).rejects.toBeInstanceOf(DSShellError);
    await expect(dssh.stdout.read()).resolves.toEqual("badly formed variable assignment\n");
});

test('dssh testvar=testval garbage', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    dssh.stdin.write('testvar=testval garbage');
    dssh.stdin.close();
    await expect(dsshpromise).rejects.toBeInstanceOf(DSShellError);
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

// VARIABLE INTERPOLATION

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

// IF statements
test('dssh if [-true]', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    TESTVAR=true\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["TESTVAR"]).toEqual("true");
});

test('dssh if [-false]', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-false]\n`
        + `    TESTVAR=true\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp).not.toHaveProperty("TESTVAR");
});

test('dssh if [-true] else', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFVAR=true\n`
        + `else\n`
        + `    ELSEVAR=true\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("ELSEVAR");
});

test('dssh if [-false] else', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-false]\n`
        + `    IFVAR=true\n`
        + `else\n`
        + `    ELSEVAR=true\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp).not.toHaveProperty("IFVAR");
    expect(dssh.envp["ELSEVAR"]).toEqual("true");
});

test('dssh nested if true true', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFAVAR=true\n`
        + `    if [-true]\n`
        + `         IFBVAR=true\n`
        + `    endif\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFAVAR"]).toEqual("true");
    expect(dssh.envp["IFBVAR"]).toEqual("true");
});

test('dssh nested if true false', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFAVAR=true\n`
        + `    if [-false]\n`
        + `         IFBVAR=true\n`
        + `    endif\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFAVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("IFBVAR");
});

test('dssh nested if else true true true', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFAVAR=true\n`
        + `    if [-true]\n`
        + `         IFBVAR=true\n`
        + `    else\n`
        + `         ELSEBVAR=true\n`
        + `    endif\n`
        + `else\n`
        + `    ELSEAVAR=true\n`
        + `    if [-true]\n`
        + `         IFCVAR=true\n`
        + `    else\n`
        + `         ELSECVAR=true\n`
        + `    endif\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFAVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("ELSEAVAR");

    expect(dssh.envp["IFBVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("ELSEBVAR");

    expect(dssh.envp).not.toHaveProperty("IFCVAR");
    expect(dssh.envp).not.toHaveProperty("ELSECVAR");

});

test('dssh nested if else false true true', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-false]\n`
        + `    IFAVAR=true\n`
        + `    if [-true]\n`
        + `         IFBVAR=true\n`
        + `    else\n`
        + `         ELSEBVAR=true\n`
        + `    endif\n`
        + `else\n`
        + `    ELSEAVAR=true\n`
        + `    if [-true]\n`
        + `         IFCVAR=true\n`
        + `    else\n`
        + `         ELSECVAR=true\n`
        + `    endif\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp).not.toHaveProperty("IFAVAR");
    expect(dssh.envp["ELSEAVAR"]).toEqual("true");

    expect(dssh.envp).not.toHaveProperty("IFBVAR");
    expect(dssh.envp).not.toHaveProperty("ELSEBVAR");

    expect(dssh.envp["IFCVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("ELSECVAR");
});

test('dssh nested if else true false true', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFAVAR=true\n`
        + `    if [-false]\n`
        + `         IFBVAR=true\n`
        + `    else\n`
        + `         ELSEBVAR=true\n`
        + `    endif\n`
        + `else\n`
        + `    ELSEAVAR=true\n`
        + `    if [-true]\n`
        + `         IFCVAR=true\n`
        + `    else\n`
        + `         ELSECVAR=true\n`
        + `    endif\n`
        + `endif\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFAVAR"]).toEqual("true");
    expect(dssh.envp).not.toHaveProperty("ELSEAVAR");

    expect(dssh.envp).not.toHaveProperty("IFBVAR");
    expect(dssh.envp["ELSEBVAR"]).toEqual("true");

    expect(dssh.envp).not.toHaveProperty("IFCVAR");
    expect(dssh.envp).not.toHaveProperty("ELSECVAR");

});

test('dssh if without endif', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    const stmt =
        `if [-true]\n`
        + `    IFVAR=true\n`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFVAR"]).toEqual("true");

});

// dssh unmatched endif
// dssh unmatched else

test('fully qualified path does not exist', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    
    resetKernel();
    const stmt =
        `if [-d /file/nonexistentfile]\n`
        + `    IFVAR=true\n`
        +`endif`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp).not.toHaveProperty("IFVAR");

});

test('relative path does not exist', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();

    resetKernel();
    const fs = DSKernel.rootfs
    const stmt =
        `cd bin\n`+
        `if [-d notadir]\n`
        + `    IFVAR=true\n`
        +`endif`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp).not.toHaveProperty("IFVAR");
});

test('fully qualified path exists', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
   
    resetKernel();
    const stmt =
        `if [-d /bin/subdir]\n`
        + `    IFVAR=true\n`
        +`endif`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFVAR"]).toEqual("true");
});

test('relative path exists', async () => {
    const dssh = makedssh();
    const dsshpromise = dssh.start();
    resetKernel();
    const stmt =
        `if [-d bin]\n`
        + `    IFVAR=true\n`
        +`endif`
    dssh.stdin.write(stmt);
    dssh.stdin.close();
    await expect(dsshpromise).resolves.toBeUndefined();
    expect(dssh.envp["IFVAR"]).toEqual("true");
});


test('dssh /fullpathexe.dssh', async () => {
    resetKernel();
    const init = resetKernel();

    const scriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/bin/dssh\n
        /bin/echo "success"\n
        \n`
    )
    scriptfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("fullpathexe.dssh", scriptfile)

    await DSKernel.exec("/fullpathexe.dssh", ['dssh'], { PATH: "/"});

    await expect(
        init.stdout.read()
    ).resolves.toEqual("success\n");
});

test('dssh /localpathexe.dssh', async () => {
    resetKernel();
    const init = resetKernel();

    const scriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/bin/dssh\n
        cd bin\n
        ./echo "success"\n
        \n`
    )
    scriptfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("localpathexe.dssh", scriptfile)

    await DSKernel.exec("/localpathexe.dssh", ['dssh'], { PATH: "/"});

    await expect(
        init.stdout.read()
    ).resolves.toEqual("success\n");
});

/*
test('', () => {

});
*/