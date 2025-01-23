import { DSConcurrentQueue } from "../src/dsConcurrentQueue";

test('DSConcurrentQueue write read', async () => {
    const q = new DSConcurrentQueue<number>();

    q.enqueue(3);
    const output = await q.dequeue();
    expect(output).toEqual(3);
});

test('DSConcurrentQueue read write', async () => {
    const q = new DSConcurrentQueue<number>();

    const promise = q.dequeue();
    expect(promise).toBeInstanceOf(Promise<number>);

    q.enqueue(5);
    expect(promise).resolves.toEqual(5);
});

/*
test('', () => {

});
*/