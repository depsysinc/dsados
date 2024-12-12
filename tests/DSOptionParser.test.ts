import { DSOptionParser, DSOptionParserError } from "../src/lib/dsOptionParser";

test('optparser.parse(noopts)', () => {
    const optparser = new DSOptionParser("testcommand");
    expect(optparser.parse(["testcommand"])).toEqual(-1);
});

test('optparser.parse(noopts) non-opt-arg', () => {
    const optparser = new DSOptionParser("testcommand");
    expect(optparser.parse(["testcommand", "arg"])).toEqual(1);
});

test('optparser.parse(noopts) -toolong (invalid option)', () => {
    const optparser = new DSOptionParser("testcommand");
    expect(() =>
        optparser.parse(["testcommand", "-toolong"])
    ).toThrow(
        new DSOptionParserError("invalid option")
    );
});

test('optparser.parse(noopts) -? (unknown option)', () => {
    const optparser = new DSOptionParser("testcommand");
    expect(() =>
        optparser.parse(["testcommand", "-?"])
    ).toThrow(
        new DSOptionParserError("unknown option")
    );
});

test('optparser.parse(noopts) --unknownlongoption (unknown option)', () => {
    const optparser = new DSOptionParser("testcommand");
    expect(() =>
        optparser.parse(["testcommand", "--unknownlongoption"])
    ).toThrow(
        new DSOptionParserError("unknown option")
    );
});

function buildTestParser(required: boolean, takesArg: boolean): DSOptionParser {
    const optparser = new DSOptionParser("testcommand");
    optparser.addoption({
        long: "testopt",
        short: "t",
        required: required,
        takesArgument: takesArg,
        argName: "",
        description: ""
    });
    return optparser;
}

test('optparser.parse(-t) -t', () => {
    const optparser = buildTestParser(false, false);

    expect(optparser.parse(["testcommand", "-t"])).toEqual(-1);
    const parsedopt = optparser.getShortOption('t');
    expect(parsedopt.seen).toEqual(true);
});

test('optparser.parse(-t) -t -t (duplicate option)', () => {
    const optparser = buildTestParser(false, false);

    expect(() =>
        optparser.parse(["testcommand", "-t", "-t"])
    ).toThrow(
        new DSOptionParserError("duplicate option")
    );
});

test('optparser.parse(--testopt) --testopt', () => {
    const optparser = buildTestParser(false, false);

    expect(optparser.parse(["testcommand", "--testopt"])).toEqual(-1);
    const parsedopt = optparser.getLongOption('testopt');
    expect(parsedopt.seen).toEqual(true);
});

test('optparser.parse(--testopt) -testopt -testopt (duplicate option)', () => {
    const optparser = buildTestParser(false, false);

    expect(() =>
        optparser.parse(["testcommand", "--testopt", "--testopt"])
    ).toThrow(
        new DSOptionParserError("duplicate option")
    );
});

test('optparser.parse(-t ARG) -t', () => {
    const optparser = buildTestParser(false, true);

    expect(() =>
        optparser.parse(["testcommand", "-t"])
    ).toThrow(
        new DSOptionParserError("missing argument")
    );
});

test('optparser.parse(-t ARG) -t testarg', () => {
    const optparser = buildTestParser(false, true);

    expect(optparser.parse(["testcommand", "-t", "testarg"])).toEqual(-1);

    const parsedopt = optparser.getShortOption('t');
    expect(parsedopt.seen).toEqual(true);
    expect(parsedopt.argument).toEqual("testarg");

});

test('optparser.parse(--testopt ARG) -testopt', () => {
    const optparser = buildTestParser(false, true);

    expect(() =>
        optparser.parse(["testcommand", "--testopt"])
    ).toThrow(
        new DSOptionParserError("missing argument")
    );
});

test('optparser.parse(--testopt ARG) --testopt testarg', () => {
    const optparser = buildTestParser(false, true);

    expect(optparser.parse(["testcommand", "--testopt", "testarg"])).toEqual(-1);

    const parsedopt = optparser.getLongOption('testopt');
    expect(parsedopt.seen).toEqual(true);
    expect(parsedopt.argument).toEqual("testarg");
});

test('optparser.parse(--testopt ARG) --testopt testarg nonoptarg', () => {
    const optparser = buildTestParser(false, true);

    expect(optparser.parse(["testcommand", "--testopt", "testarg", "nonoptarg"])).toEqual(3);

    const parsedopt = optparser.getLongOption('testopt');
    expect(parsedopt.seen).toEqual(true);
    expect(parsedopt.argument).toEqual("testarg");
});

test('optparser.parse(-t) (required option missing)', () => {
    const optparser = buildTestParser(true, false);

    expect(() =>
        optparser.parse(["testcommand"])
    ).toThrow(
        new DSOptionParserError("required option missing")
    );
});

function buildTestParser_allOptionTypes(): DSOptionParser {
    const optparser = new DSOptionParser(
        "testcommand",
        true, // help option
          "this is the description for a test command\n"
        + "this description has multiple lines to see\n"
        + "what that looks like in the console");
    optparser.addoption({
        long: "required",
        short: "r",
        required: true,
        takesArgument: false,
        argName: "",
        description: "a required argument"
    });
    optparser.addoption({
        long: "just-long",
        short: "",
        required: false,
        takesArgument: false,
        argName: "",
        description: "an option that is only long"
    });
    optparser.addoption({
        long: "",
        short: "s",
        required: false,
        takesArgument: false,
        argName: "",
        description: "an option that is only short"
    });
    optparser.addoption({
        long: "takesarg",
        short: "t",
        required: false,
        takesArgument: true,
        argName: "ARG",
        description: "an option that takes an argument"
    });
    optparser.addoption({
        long: "argrequired",
        short: "a",
        required: true,
        takesArgument: true,
        argName: "ARG",
        description: "a required option that takes an argument"
    });

    return optparser;
}
test('usage', () => {
    const parser = buildTestParser_allOptionTypes();
    // console.log(parser.usage());
});


/*
test('', () => {

});
*/