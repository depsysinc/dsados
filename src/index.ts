// Import the xterm module
import { Terminal } from '@xterm/xterm';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import './styles.css'

// Create a div container for the terminal
const terminalContainer = document.createElement("div");
terminalContainer.id = "terminal-container";

// Append the terminal container to the body of the document
document.body.appendChild(terminalContainer);

// Initialize the xterm Terminal
const terminal = new Terminal(
    {
        cols: 80,              // Set the number of columns (width)
        rows: 24,              // Set the number of rows (height)
        fontFamily: 'CRTFont, monospace', // Set the font family
        fontSize: 32,          // Set the font size
        fontWeight: 'normal',  // Optional: font weight
    }
);

// Open the terminal in the specified container
terminal.open(terminalContainer);
terminal.loadAddon(new WebglAddon());

// Write "Hello world!" to the terminal
terminal.write("Hello world!\r\nThis is some more font ABCDEFGHIJKLMNOP");

console.log("Index complete");