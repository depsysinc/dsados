import { DSStream, DSStreamClosedError } from "../src/dsStream"


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

    const promise = stream.read();
    expect(promise).toBeInstanceOf(Promise<string>);

    stream.write("output");
    await expect(promise).resolves.toEqual("output");
});

test('DSStream close then read', async () => {
    const stream = new DSStream();

    expect(stream.closed).toEqual(false);
    stream.close();
    expect(stream.closed).toEqual(true);

    const promise = stream.read();

    await expect(promise).rejects.toEqual(new DSStreamClosedError("End of Stream"));
});

test('DSStream read then close', async () => {
    const stream = new DSStream();

    const promise = stream.read();

    stream.close();

    await expect(promise).rejects.toEqual(new DSStreamClosedError("End of Stream"));
});

test('DSStream write, close, read, read', async () => {
    const stream = new DSStream();

    stream.write("test string");
    stream.close();

    let promise = stream.read();
    await expect(promise).resolves.toEqual("test string");

    promise = stream.read();
    await expect(promise).rejects.toEqual(new DSStreamClosedError("End of Stream"));
});

test('DSStream write, read, read, close', async () => {
    const stream = new DSStream();

    stream.write("test string");

    let promise = stream.read();
    await expect(promise).resolves.toEqual("test string");

    promise = stream.read();
    stream.close();
    await expect(promise).rejects.toEqual(new DSStreamClosedError("End of Stream"));
});

test('DSStream close then write', () => {
    const stream = new DSStream();

    stream.close();

    expect(() =>
        stream.write("test")
    ).toThrow(
        new DSStreamClosedError("Cannot write to closed stream")
    );
});

/*
test('', () => {

});
*/