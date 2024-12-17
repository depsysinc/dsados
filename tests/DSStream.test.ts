import { DSStream } from "../src/dsStream"


test('DSStream write then read', async () => {
    const stream = new DSStream();
    expect(stream.readsPending()).toEqual(0);

    stream.write("test string");
    expect(stream.readsPending()).toEqual(1);

    const output = await stream.read();
    expect(stream.readsPending()).toEqual(0);
    expect(output).toEqual("test string");
});

test('DSStream write, read, write, read', async () => {
    const stream = new DSStream();

    stream.write("first");
    let output = await stream.read();
    expect(output).toEqual("first");

    stream.write("second");
    output = await stream.read();
    expect(output).toEqual("second");
});

test('DSStream write, write, read, read', async () => {
    const stream = new DSStream();

    stream.write("first");
    stream.write("second");
    expect(stream.readsPending()).toEqual(2);

    let output = await stream.read();
    expect(output).toEqual("first");
    output = await stream.read();
    expect(output).toEqual("second");
});

test('DSStream read then write (block on promise)', async () => {
    const stream = new DSStream();

    let output: string | undefined = undefined;

    const promise = stream.read();
    expect(promise).toBeInstanceOf(Promise<string>);
    
    stream.write("output");
    await expect(promise).resolves.toEqual("output");
});

/*
test('', () => {

});
*/