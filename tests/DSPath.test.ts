import { DSRAMFileSystem } from '../src/dsFileSystem';
import { DSIWebFile } from '../src/filesystem/dsIWebFile';
import { getAbsolutePath, getDirPath, getFileName } from '../src/lib/dsPath'

test('Get directory path local', () => {
    const testpath = 'subfolder/test.txt'
    let dirpath = getDirPath(testpath)
    expect(dirpath).toEqual('subfolder')
});


test('Get directory path absolute', () => {
    const testpath = '/very/long/absolute/path/file.png'
    let dirpath = getDirPath(testpath)
    expect(dirpath).toEqual('/very/long/absolute/path')
});


test('Get directory path root', () => {
    const testpath = '/'
    expect(getDirPath(testpath)).toEqual('')
});


test('Get directory path for plain filename', () => {
    const testpath = 'localfile'
    expect(getDirPath(testpath)).toEqual('.')
});


test('Get filename local', () => {
    const testpath = 'subfolder/test.txt'
    let filename = getFileName(testpath)
    expect(filename).toEqual('test.txt')
});


test('Get filename absolute', () => {
    const testpath = '/very/long/absolute/path/file.png'
    let filename = getFileName(testpath)
    expect(filename).toEqual('file.png')
});


test('Get plain filename', () => {
    const testpath = 'localfile'
    expect(getFileName(testpath)).toEqual('localfile')
});

test('Absolute path one subfolder down', () => {
    const fs = new DSRAMFileSystem();
    const subdir = fs.root.mkdir('subdir');
    subdir.addfile('file.txt', new DSIWebFile(fs, ''))

    const localpath = 'file.txt'
    const absolutepath = '/subdir/file.txt'

    expect(getAbsolutePath(subdir, localpath)).toEqual(absolutepath)
});

test('Absolute path multiple subfolders down', () => {
    const fs = new DSRAMFileSystem();
    const subdir1 = fs.root.mkdir('subdir1');
    const subdir2 = subdir1.mkdir('subdir2');
    const subdir3 = subdir2.mkdir('subdir3');

    subdir3.addfile('test.png', new DSIWebFile(fs, ''))
    const absolutepath = '/subdir1/subdir2/subdir3/test.png'

    expect(getAbsolutePath(fs.root, 'subdir1/subdir2/subdir3/test.png')).toEqual(absolutepath)
    expect(getAbsolutePath(subdir1, 'subdir2/subdir3/test.png')).toEqual(absolutepath)
    expect(getAbsolutePath(subdir2, 'subdir3/test.png')).toEqual(absolutepath)
    expect(getAbsolutePath(subdir3, 'test.png')).toEqual(absolutepath)
});

test('Absolute path given already absolute path', () => {
    const fs = new DSRAMFileSystem();
    const subdir = fs.root.mkdir('subdir');
    subdir.addfile('file.txt', new DSIWebFile(fs, ''))

    const absolutepath = '/subdir/file.txt'
    expect(getAbsolutePath(subdir, absolutepath)).toEqual(absolutepath)

});

test('Absolute path from root', () => {
    const fs = new DSRAMFileSystem();
    fs.root.addfile('rootfile.dsmd',new DSIWebFile(fs, ''));
    expect(getAbsolutePath(fs.root,'rootfile.dsmd')).toEqual('/rootfile.dsmd')
});

test('Absolute path with ..', () => {
    const fs = new DSRAMFileSystem();
    const subdir = fs.root.mkdir('subdir');
    fs.root.addfile('fileroot.gif', new DSIWebFile(fs, ''))

    const localpath = '../fileroot.gif'

    expect(getAbsolutePath(subdir, localpath)).toEqual('/fileroot.gif')
});

test('Absolute path with .', () => {
    const fs = new DSRAMFileSystem();
    const subdir = fs.root.mkdir('subdir');
    subdir.addfile('.gitignoreforexample', new DSIWebFile(fs, ''))

    const localpath = './.gitignoreforexample'

    expect(getAbsolutePath(subdir, localpath)).toEqual('/subdir/.gitignoreforexample')
});

test('Complex local path', () => {
    const fs = new DSRAMFileSystem();
    const alpha = fs.root.mkdir('alpha');
    const beta1 = alpha.mkdir('beta1');
    const beta2 = alpha.mkdir('beta2')

    beta2.addfile('file.txt', new DSIWebFile(fs, ''))

    const localpath = '.././../alpha/./beta1/../beta2/./file.txt'

    expect(getAbsolutePath(beta1, localpath)).toEqual('/alpha/beta2/file.txt')
});
