// Import the xterm module
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';

// Create a div container for the terminal
const terminalContainer = document.createElement("div");
terminalContainer.id = "terminal-container";

// Append the terminal container to the body of the document
document.body.appendChild(terminalContainer);

// Initialize the xterm Terminal
const terminal = new Terminal();

// Open the terminal in the specified container
terminal.open(terminalContainer);

// Write "Hello world!" to the terminal
terminal.write("Hello world!\r\n");
