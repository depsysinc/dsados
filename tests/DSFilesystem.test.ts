import { DSFilesystem } from "../src/dsFilesystem"

function createTestFS(): DSFilesystem {
    return new DSFilesystem();
}

test('Checkpath', () => {
    const fs = createTestFS();
    expect(fs.root).toBeDefined();
});