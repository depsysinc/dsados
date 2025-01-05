import { DSFilePerms, DSFilePermsExecError, DSFileSystemError, DSIDirectory, DSIDirectoryInvalidPathError, DSInode, DSRAMFileSystem } from "../src/dsFileSystem";
import { DSKernel, DSKernelError, DSKernelExecError } from "../src/dsKernel";
import { DSProcess } from "../src/dsProcess";
import { DSStream } from "../src/dsStream";
import { DSIProcessFile } from "../src/filesystem/dsIProcessFile";
import { DSIStaticTextFile } from "../src/filesystem/dsIStaticFile";
import { DSShell } from "../src/process/dssh";
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

    let binfile: DSInode = new DSIProcessFile(DSKernel.rootfs, DSShell);
    DSKernel.rootdir.addfile("dssh", binfile);

    binfile = new DSIProcessFile(DSKernel.rootfs, PREcho);
    DSKernel.rootdir.addfile("echo", binfile);

    return init;
}

test('exec /bad/path', async () => {
    resetKernel();

    await expect(
        DSKernel.exec("/bad/path", [], {})
    ).rejects.toThrow(
        DSIDirectoryInvalidPathError
    );
});

test('exec /noexecperms.txt', async () => {
    resetKernel();
    DSKernel.rootdir.addfile("noexecperms.txt",
        new DSIStaticTextFile(DSKernel.rootfs,
            `Some test text\n
            to test some lines\n
            and stuff`
        )
    )

    await expect(
        DSKernel.exec("/noexecperms.txt", [], {})
    ).rejects.toThrow(
        DSKernelExecError
    );
});

test('exec /notascript.txt', async () => {
    resetKernel();
    const nonscriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `Some test text\n
        to test some lines\n
        and stuff, but this isn't a script`
    )
    nonscriptfile.chmod(DSFilePerms.rx());

    DSKernel.rootdir.addfile("notascript.txt", nonscriptfile)

    await expect(
        DSKernel.exec("/notascript.txt", [], {})
    ).rejects.toThrow(
        DSKernelExecError
    );
});

test('exec /interpreternotfound.dssh', async () => {
    resetKernel();
    const interpreternotfoundfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/interpreternotfound\n
        echo "never get here"\n
        CRless line`
    )
    interpreternotfoundfile.chmod(DSFilePerms.rx());

    DSKernel.rootdir.addfile("interpreternotfound.dssh", interpreternotfoundfile)

    await expect(
        DSKernel.exec("/interpreternotfound.dssh", [], {})
    ).rejects.toThrow(
        DSIDirectoryInvalidPathError
    );
});

test('exec /interpreternotexe.dssh', async () => {
    resetKernel();
    const scriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/interpreternotexe\n
        echo "never get here"\n
        CRless line`
    )
    scriptfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("interpreternotexe.dssh", scriptfile)

    const interpreterfile = new DSIStaticTextFile(DSKernel.rootfs,
        `this is not an executable file`
    )
    interpreterfile.chmod(DSFilePerms.readonly());
    DSKernel.rootdir.addfile("interpreternotexe", interpreterfile)

    await expect(
        DSKernel.exec("/interpreternotexe.dssh", [], {})
    ).rejects.toThrow(DSFilePermsExecError);
});

test('exec /interpreternotbin.dssh', async () => {
    resetKernel();
    const scriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/interpreternotbin\n
        echo "never get here"\n
        CRless line`
    )
    scriptfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("interpreternotbin.dssh", scriptfile)

    const interpreterfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/bin/dssh\n
        echo "A script that isn't a real binary"\n`
    )
    interpreterfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("interpreternotbin", interpreterfile)

    await expect(
        DSKernel.exec("/interpreternotbin.dssh", [], {})
    ).rejects.toThrow(DSKernelExecError);
});

test('exec /simpleechoscript.dssh', async () => {
    const init = resetKernel();

    const scriptfile = new DSIStaticTextFile(DSKernel.rootfs,
        `#!/dssh\n
        echo "success"\n
        \n`
    )
    scriptfile.chmod(DSFilePerms.rx());
    DSKernel.rootdir.addfile("simpleechoscript.dssh", scriptfile)

    await DSKernel.exec("/simpleechoscript.dssh", [], { PATH: "/"});

    await expect(
        init.stdout.read()
    ).resolves.toEqual("success\n");
});
/*
 
test('', () => {

});
*/